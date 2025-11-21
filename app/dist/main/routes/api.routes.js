import { TokenHandlerAdapter } from "../../adapters/token-handler-adapter.js";
import { UuidGeneratorAdapter } from "../../adapters/uuid-generator-adapter.js";
import { SESSION_COOKIE_NAME } from "../../constants/session.js";
import { usersModel } from "../../db/models/users-model.js";
import { userModel } from "../../db/models/user.model.js";
import { deckModel } from "../../db/models/deck.model.js";
import { flashcardModel } from "../../db/models/flashcard.model.js";
import { integrationModel } from "../../db/models/integration.model.js";
import { authMiddleware } from "../../controllers/middlewares/authMiddleware.js";
import { Router } from "express";
import bcrypt from "bcryptjs";
const apiRouter = Router();
let jwtAdapter = null;
const COOKIE_MAX_AGE = 60 * 60 * 1000; // 1 hour
const getJwtAdapter = () => {
    if (!jwtAdapter) {
        jwtAdapter = new TokenHandlerAdapter();
    }
    return jwtAdapter;
};
const createToastMarkup = (message, variant = "info") => `
  <div class="toast show align-items-center text-bg-${variant} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  </div>
`;
const sendToastResponse = (res, options) => {
    res
        .status(options.status ?? 200)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(createToastMarkup(options.message, options.variant));
};
const setSessionCookie = (res, token) => {
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
    });
};
const parseTags = (value) => {
    if (Array.isArray(value)) {
        return value.map(String).map((tag) => tag.trim()).filter(Boolean);
    }
    if (!value) {
        return [];
    }
    return String(value)
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
};
const buildDeckParams = (req) => ({
    name: req.body?.name?.toString()?.trim(),
    description: req.body?.description?.toString()?.trim() ?? null,
    subject: req.body?.subject?.toString()?.trim() ?? null,
    tags: parseTags(req.body?.tags),
});
const ensureDeckBelongsToUser = async (deckId, userId) => deckModel.findOne({
    params: [
        { key: "id", value: deckId },
        { key: "user_id", value: userId },
    ],
});
const buildCardPreviewMarkup = (cards) => {
    if (cards.length === 0) {
        return `
      <div class="card border-0 shadow-sm">
        <div class="card-body p-4 text-center text-secondary">
          <i class="bi bi-magic fs-1 text-primary mb-3 d-block"></i>
          <p class="mb-0">Não foi possível gerar sugestões a partir do conteúdo enviado.</p>
        </div>
      </div>
    `;
    }
    const items = cards
        .map((card, index) => `
        <div class="card border-0 shadow-sm">
          <div class="card-body p-4 d-grid gap-2">
            <div class="d-flex justify-content-between align-items-center">
              <span class="badge text-bg-primary-subtle text-primary">Sugestão ${index + 1}</span>
              <span class="text-secondary small">Gerado pela IA</span>
            </div>
            <p class="fw-semibold mb-1">${card.question}</p>
            <p class="mb-0 text-secondary">${card.answer}</p>
          </div>
        </div>
      `)
        .join("");
    return `<div class="d-flex flex-column gap-3">${items}</div>`;
};
const handleUnexpectedError = (context, error, res) => {
    console.error(context, error);
    sendToastResponse(res, {
        status: 500,
        message: "Ocorreu um erro inesperado. Tente novamente em instantes.",
        variant: "danger",
    });
};
const getAuthenticatedUser = (req) => {
    return req.body?.user ?? null;
};
const ensureAuthenticatedUser = (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        sendToastResponse(res, {
            status: 401,
            message: "Sua sessão expirou. Faça login novamente para continuar.",
            variant: "danger",
        });
        return null;
    }
    return user;
};
const parseCheckbox = (value) => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        return value === "on" || value === "true";
    }
    return Boolean(value);
};
const computeNextReviewDate = (difficulty) => {
    const now = new Date();
    const intervals = {
        easy: 3,
        medium: 1,
        hard: 0,
    };
    const days = intervals[difficulty];
    if (days === 0) {
        return now;
    }
    const nextReview = new Date(now);
    nextReview.setDate(now.getDate() + days);
    return nextReview;
};
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const normalizeDifficulty = (value) => {
    if (typeof value === "string" && DIFFICULTIES.has(value)) {
        return value;
    }
    return "medium";
};
apiRouter.post("/auth/register", async (req, res) => {
    const { firstName, lastName, email, password, confirmPassword } = req.body ?? {};
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        sendToastResponse(res, {
            status: 400,
            message: "Preencha todos os campos obrigatórios para criar sua conta.",
            variant: "danger",
        });
        return;
    }
    if (password !== confirmPassword) {
        sendToastResponse(res, {
            status: 400,
            message: "As senhas informadas não conferem.",
            variant: "danger",
        });
        return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
        const existingUser = await usersModel.findByEmail(normalizedEmail);
        if (existingUser) {
            sendToastResponse(res, {
                status: 409,
                message: "Já existe uma conta utilizando este e-mail.",
                variant: "danger",
            });
            return;
        }
        const hashedPassword = await bcrypt.hash(String(password), 10);
        const id = UuidGeneratorAdapter.generate();
        await usersModel.createUser({
            id,
            name: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
            email: normalizedEmail,
            password: hashedPassword,
        });
        const token = getJwtAdapter().generateToken({ userId: id });
        setSessionCookie(res, token);
        res.setHeader("HX-Redirect", "/app/decks");
        sendToastResponse(res, {
            status: 201,
            message: "Conta criada com sucesso! Redirecionando...",
            variant: "success",
        });
    }
    catch (error) {
        console.error("Failed to register user", error);
        sendToastResponse(res, {
            status: 500,
            message: "Não foi possível criar sua conta. Tente novamente em instantes.",
            variant: "danger",
        });
    }
});
apiRouter.post("/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        sendToastResponse(res, {
            status: 400,
            message: "Informe seu e-mail e senha para continuar.",
            variant: "danger",
        });
        return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
        const user = await usersModel.findByEmail(normalizedEmail);
        if (!user) {
            sendToastResponse(res, {
                status: 401,
                message: "Credenciais inválidas.",
                variant: "danger",
            });
            return;
        }
        const isValidPassword = await bcrypt.compare(String(password), user.password);
        if (!isValidPassword) {
            sendToastResponse(res, {
                status: 401,
                message: "Credenciais inválidas.",
                variant: "danger",
            });
            return;
        }
        const token = getJwtAdapter().generateToken({ userId: user.id });
        setSessionCookie(res, token);
        res.setHeader("HX-Redirect", "/app/decks");
        sendToastResponse(res, {
            status: 200,
            message: "Login realizado com sucesso! Redirecionando...",
            variant: "success",
        });
    }
    catch (error) {
        console.error("Failed to authenticate user", error);
        sendToastResponse(res, {
            status: 500,
            message: "Não foi possível acessar sua conta. Tente novamente em instantes.",
            variant: "danger",
        });
    }
});
apiRouter.use(authMiddleware);
apiRouter.post("/decks", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const params = buildDeckParams(req);
    if (!params.name || !params.subject) {
        sendToastResponse(res, {
            status: 400,
            message: "Informe ao menos o nome e o assunto do baralho.",
            variant: "danger",
        });
        return;
    }
    try {
        await deckModel.insert({
            fields: [
                { key: "id", value: UuidGeneratorAdapter.generate() },
                { key: "name", value: params.name },
                { key: "description", value: params.description },
                { key: "subject", value: params.subject },
                { key: "tags", value: params.tags },
                { key: "user_id", value: user.id },
            ],
        });
        sendToastResponse(res, {
            status: 201,
            message: "Baralho criado com sucesso! Atualize a página para visualizar as mudanças.",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to create deck", error, res);
    }
});
apiRouter.put("/decks/:deckId", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const { deckId } = req.params;
    try {
        const deck = await ensureDeckBelongsToUser(deckId, user.id);
        if (!deck) {
            sendToastResponse(res, {
                status: 404,
                message: "Baralho não encontrado.",
                variant: "danger",
            });
            return;
        }
        const params = buildDeckParams(req);
        const updates = [];
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
            if (!params.name) {
                sendToastResponse(res, {
                    status: 400,
                    message: "O nome do baralho não pode ficar em branco.",
                    variant: "danger",
                });
                return;
            }
            updates.push({ key: "name", value: params.name });
        }
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "description")) {
            updates.push({ key: "description", value: params.description });
        }
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "subject")) {
            updates.push({ key: "subject", value: params.subject });
        }
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "tags")) {
            updates.push({ key: "tags", value: params.tags });
        }
        if (updates.length === 0) {
            sendToastResponse(res, {
                status: 200,
                message: "Nenhuma alteração foi enviada para este baralho.",
                variant: "info",
            });
            return;
        }
        await deckModel.update({
            id: deckId,
            fields: updates,
        });
        sendToastResponse(res, {
            status: 200,
            message: "Baralho atualizado com sucesso!",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to update deck", error, res);
    }
});
apiRouter.delete("/decks/:deckId", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const { deckId } = req.params;
    try {
        const deck = await ensureDeckBelongsToUser(deckId, user.id);
        if (!deck) {
            sendToastResponse(res, {
                status: 404,
                message: "Baralho não encontrado.",
                variant: "danger",
            });
            return;
        }
        await deckModel.delete({
            params: [
                { key: "id", value: deckId },
                { key: "user_id", value: user.id },
            ],
        });
        sendToastResponse(res, {
            status: 200,
            message: "Baralho removido com sucesso.",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to delete deck", error, res);
    }
});
apiRouter.post("/decks/:deckId/cards", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const { deckId } = req.params;
    const question = req.body?.question?.toString()?.trim();
    const answer = req.body?.answer?.toString()?.trim();
    const difficulty = normalizeDifficulty(req.body?.difficulty);
    const tags = parseTags(req.body?.tags);
    if (!question || !answer) {
        sendToastResponse(res, {
            status: 400,
            message: "Informe pergunta e resposta para criar uma carta.",
            variant: "danger",
        });
        return;
    }
    try {
        const deck = await ensureDeckBelongsToUser(deckId, user.id);
        if (!deck) {
            sendToastResponse(res, {
                status: 404,
                message: "Baralho não encontrado.",
                variant: "danger",
            });
            return;
        }
        await flashcardModel.insert({
            fields: [
                { key: "id", value: UuidGeneratorAdapter.generate() },
                { key: "question", value: question },
                { key: "answer", value: answer },
                { key: "user_id", value: user.id },
                { key: "deck_id", value: deckId },
                { key: "status", value: "new" },
                { key: "review_count", value: 0 },
                { key: "last_review_date", value: null },
                { key: "next_review_date", value: null },
                { key: "difficulty", value: difficulty },
                { key: "tags", value: tags },
                { key: "source", value: req.body?.source?.toString() ?? "Manual" },
            ],
        });
        sendToastResponse(res, {
            status: 201,
            message: "Carta criada com sucesso!",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to create card", error, res);
    }
});
apiRouter.put("/decks/:deckId/cards/:cardId", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const { deckId, cardId } = req.params;
    try {
        const card = (await flashcardModel.findOne({
            params: [
                { key: "id", value: cardId },
                { key: "deck_id", value: deckId },
                { key: "user_id", value: user.id },
            ],
        }));
        if (!card) {
            sendToastResponse(res, {
                status: 404,
                message: "Carta não encontrada.",
                variant: "danger",
            });
            return;
        }
        const updates = [];
        const question = req.body?.question?.toString()?.trim();
        const answer = req.body?.answer?.toString()?.trim();
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "question")) {
            if (!question) {
                sendToastResponse(res, {
                    status: 400,
                    message: "A pergunta não pode ficar vazia.",
                    variant: "danger",
                });
                return;
            }
            updates.push({ key: "question", value: question });
        }
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "answer")) {
            if (!answer) {
                sendToastResponse(res, {
                    status: 400,
                    message: "A resposta não pode ficar vazia.",
                    variant: "danger",
                });
                return;
            }
            updates.push({ key: "answer", value: answer });
        }
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "difficulty")) {
            updates.push({ key: "difficulty", value: normalizeDifficulty(req.body?.difficulty) });
        }
        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "tags")) {
            updates.push({ key: "tags", value: parseTags(req.body?.tags) });
        }
        if (updates.length === 0) {
            sendToastResponse(res, {
                status: 200,
                message: "Nenhuma alteração foi aplicada nesta carta.",
                variant: "info",
            });
            return;
        }
        await flashcardModel.update({ id: cardId, fields: updates });
        sendToastResponse(res, {
            status: 200,
            message: "Carta atualizada com sucesso!",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to update card", error, res);
    }
});
apiRouter.delete("/decks/:deckId/cards/:cardId", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const { deckId, cardId } = req.params;
    try {
        const card = await flashcardModel.findOne({
            params: [
                { key: "id", value: cardId },
                { key: "deck_id", value: deckId },
                { key: "user_id", value: user.id },
            ],
        });
        if (!card) {
            sendToastResponse(res, {
                status: 404,
                message: "Carta não encontrada.",
                variant: "danger",
            });
            return;
        }
        await flashcardModel.delete({
            params: [
                { key: "id", value: cardId },
                { key: "deck_id", value: deckId },
                { key: "user_id", value: user.id },
            ],
        });
        sendToastResponse(res, {
            status: 200,
            message: "Carta removida com sucesso.",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to delete card", error, res);
    }
});
apiRouter.post("/decks/:deckId/generate", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const { deckId } = req.params;
    const content = req.body?.content?.toString()?.trim();
    if (!content) {
        res
            .status(400)
            .setHeader("Content-Type", "text/html; charset=utf-8")
            .send('<div class="alert alert-danger" role="alert">Cole algum conteúdo para que possamos gerar sugestões.</div>');
        return;
    }
    try {
        const deck = await ensureDeckBelongsToUser(deckId, user.id);
        if (!deck) {
            res
                .status(404)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .send('<div class="alert alert-danger" role="alert">Baralho não encontrado.</div>');
            return;
        }
        const sections = content
            .split(/\n+/)
            .map((section) => section.trim())
            .filter((section) => section.length > 0);
        const cards = sections.slice(0, 3).map((section) => ({
            question: `Qual é o conceito principal sobre "${section.slice(0, 60)}"?`,
            answer: section.length > 280 ? `${section.slice(0, 277)}...` : section,
        }));
        const createImmediately = parseCheckbox(req.body?.createImmediately);
        if (createImmediately && cards.length > 0) {
            for (const suggestion of cards) {
                await flashcardModel.insert({
                    fields: [
                        { key: "id", value: UuidGeneratorAdapter.generate() },
                        { key: "question", value: suggestion.question },
                        { key: "answer", value: suggestion.answer },
                        { key: "user_id", value: user.id },
                        { key: "deck_id", value: deckId },
                        { key: "status", value: "new" },
                        { key: "review_count", value: 0 },
                        { key: "last_review_date", value: null },
                        { key: "next_review_date", value: null },
                        { key: "difficulty", value: "medium" },
                        { key: "tags", value: [] },
                        {
                            key: "source",
                            value: req.body?.goal?.toString() ? `Objetivo: ${req.body.goal}` : "Sugestão da IA",
                        },
                    ],
                });
            }
            res
                .status(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .send(`<div class="alert alert-success" role="alert">${cards.length} flashcards foram adicionados diretamente ao baralho.</div>`);
            return;
        }
        res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(buildCardPreviewMarkup(cards));
    }
    catch (error) {
        console.error("Failed to generate AI suggestion", error);
        res
            .status(500)
            .setHeader("Content-Type", "text/html; charset=utf-8")
            .send('<div class="alert alert-danger" role="alert">Não foi possível gerar sugestões no momento. Tente novamente mais tarde.</div>');
    }
});
apiRouter.put("/account", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const updates = [];
    const name = req.body?.name?.toString()?.trim();
    const email = req.body?.email?.toString()?.trim()?.toLowerCase();
    const timezone = req.body?.timezone?.toString()?.trim();
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
        if (!name) {
            sendToastResponse(res, {
                status: 400,
                message: "Informe um nome válido.",
                variant: "danger",
            });
            return;
        }
        updates.push({ key: "name", value: name });
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "email")) {
        if (!email) {
            sendToastResponse(res, {
                status: 400,
                message: "Informe um e-mail válido.",
                variant: "danger",
            });
            return;
        }
        updates.push({ key: "email", value: email });
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "timezone") && timezone) {
        updates.push({ key: "timezone", value: timezone });
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "goal")) {
        const goalValue = Number(req.body.goal);
        if (Number.isNaN(goalValue) || goalValue <= 0) {
            sendToastResponse(res, {
                status: 400,
                message: "A meta diária precisa ser um número positivo.",
                variant: "danger",
            });
            return;
        }
        updates.push({ key: "goal_per_day", value: goalValue });
    }
    if (updates.length === 0) {
        sendToastResponse(res, {
            status: 200,
            message: "Nenhuma alteração foi aplicada ao seu perfil.",
            variant: "info",
        });
        return;
    }
    try {
        await userModel.update({ id: user.id, fields: updates });
        sendToastResponse(res, {
            status: 200,
            message: "Dados da conta atualizados com sucesso!",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to update account", error, res);
    }
});
apiRouter.put("/account/preferences", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    try {
        await userModel.update({
            id: user.id,
            fields: [
                { key: "reminder_email", value: parseCheckbox(req.body?.reminderEmail) },
                { key: "reminder_push", value: parseCheckbox(req.body?.reminderPush) },
                { key: "weekly_summary", value: parseCheckbox(req.body?.weeklySummary) },
                { key: "ai_suggestions", value: parseCheckbox(req.body?.aiSuggestions) },
            ],
        });
        sendToastResponse(res, {
            status: 200,
            message: "Preferências atualizadas com sucesso!",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to update preferences", error, res);
    }
});
apiRouter.put("/integrations/:integrationId", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const { integrationId } = req.params;
    try {
        const integration = await integrationModel.findOne({
            params: [
                { key: "id", value: integrationId },
                { key: "user_id", value: user.id },
            ],
        });
        if (!integration) {
            sendToastResponse(res, {
                status: 404,
                message: "Integração não encontrada.",
                variant: "danger",
            });
            return;
        }
        await integrationModel.update({
            id: integrationId,
            fields: [
                { key: "connected", value: parseCheckbox(req.body?.connected) },
                { key: "name", value: req.body?.name?.toString() ?? integration.name },
            ],
        });
        sendToastResponse(res, {
            status: 200,
            message: "Integração atualizada com sucesso!",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to update integration", error, res);
    }
});
apiRouter.post("/review/grade", async (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const cardId = req.body?.cardId?.toString();
    const difficulty = normalizeDifficulty(req.body?.difficulty);
    if (!cardId) {
        sendToastResponse(res, {
            status: 400,
            message: "Informe a carta que deseja avaliar.",
            variant: "danger",
        });
        return;
    }
    try {
        const card = (await flashcardModel.findOne({
            params: [
                { key: "id", value: cardId },
                { key: "user_id", value: user.id },
            ],
        }));
        if (!card) {
            sendToastResponse(res, {
                status: 404,
                message: "Carta não encontrada.",
                variant: "danger",
            });
            return;
        }
        const nextReview = computeNextReviewDate(difficulty);
        await flashcardModel.update({
            id: cardId,
            fields: [
                { key: "difficulty", value: difficulty },
                { key: "status", value: difficulty === "easy" ? "mastered" : "learning" },
                { key: "review_count", value: (card.review_count ?? 0) + 1 },
                { key: "last_review_date", value: new Date() },
                { key: "next_review_date", value: nextReview },
            ],
        });
        sendToastResponse(res, {
            status: 200,
            message: "Progresso registrado! Continue avançando.",
            variant: "success",
        });
    }
    catch (error) {
        handleUnexpectedError("Failed to grade card", error, res);
    }
});
apiRouter.get("/review/hint", (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const hints = [
        "Explique a carta com suas próprias palavras para consolidar o aprendizado.",
        "Relacione o conteúdo com experiências pessoais para criar memórias duradouras.",
        "Intercale cartas fáceis e difíceis para evitar fadiga cognitiva.",
    ];
    const hint = hints[Math.floor(Math.random() * hints.length)];
    sendToastResponse(res, {
        status: 200,
        message: hint,
        variant: "info",
    });
});
apiRouter.get("/insights", (req, res) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
        return;
    }
    const insights = [
        "Dedique os próximos 15 minutos aos baralhos com mais cartas pendentes para destravar progresso imediato.",
        "Experimente revisar cartas antigas antes de criar novas para reforçar a retenção.",
        "Suas revisões matinais têm melhor desempenho: planeje sessões curtas logo ao acordar.",
    ];
    const insight = insights[Math.floor(Math.random() * insights.length)];
    sendToastResponse(res, {
        status: 200,
        message: insight,
        variant: "info",
    });
});
export { apiRouter };
