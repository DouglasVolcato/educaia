import { cardGenerationProcessModel } from "../../db/models/card-generation-process.model.js";
import { DeckCardGeneratorService } from "../../ai/deck-card-generator-service.js";
import { flashcardModel } from "../../db/models/flashcard.model.js";
import { UuidGeneratorAdapter } from "../../adapters/uuid-generator-adapter.js";
import { deckGenerationQueue } from "../../queue/deck-generation-queue.js";
import { deckModel } from "../../db/models/deck.model.js";
import { deckGenerateRateLimiter } from "../rate-limiters.js";
import { BaseController } from "../base-controller.js";
import { renderFile } from "ejs";
import path from "path";
import { z } from "zod";
export class DecksController extends BaseController {
    constructor(app) {
        super(app);
        this.handleCreateDeck = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const deckBaseSchema = this.createDeckBaseSchema();
            const createDeckSchema = deckBaseSchema
                .pick({ name: true, description: true, subject: true, tags: true })
                .extend({
                name: deckBaseSchema.shape.name.min(1, "Informe ao menos o nome e o assunto do baralho."),
                subject: deckBaseSchema.shape.subject.min(1, "Informe ao menos o nome e o assunto do baralho."),
            });
            const parsed = createDeckSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
                this.sendToastResponse(res, { status: 400, message, variant: "danger" });
                return;
            }
            const params = this.buildDeckParams(parsed.data);
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
                this.sendToastResponse(res, {
                    status: 201,
                    message: "Baralho criado com sucesso! Atualize a página para visualizar as mudanças.",
                    variant: "success",
                });
            }
            catch (error) {
                this.handleUnexpectedError("Failed to create deck", error, res);
            }
        };
        this.handleUpdateDeck = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const { deckId } = req.params;
            try {
                const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
                if (!deck) {
                    this.sendToastResponse(res, {
                        status: 404,
                        message: "Baralho não encontrado.",
                        variant: "danger",
                    });
                    return;
                }
                const deckBaseSchema = this.createDeckBaseSchema();
                const updateDeckSchema = deckBaseSchema.partial().extend({
                    name: deckBaseSchema.shape.name
                        .min(1, "O nome do baralho não pode ficar em branco.")
                        .optional(),
                });
                const parsed = updateDeckSchema.safeParse(req.body ?? {});
                if (!parsed.success) {
                    const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
                    this.sendToastResponse(res, { status: 400, message, variant: "danger" });
                    return;
                }
                const updates = [];
                const hasName = Object.prototype.hasOwnProperty.call(parsed.data, "name");
                const hasDescription = Object.prototype.hasOwnProperty.call(parsed.data, "description");
                const hasSubject = Object.prototype.hasOwnProperty.call(parsed.data, "subject");
                const hasTags = Object.prototype.hasOwnProperty.call(parsed.data, "tags");
                if (hasName && parsed.data.name) {
                    updates.push({ key: "name", value: parsed.data.name });
                }
                if (hasDescription) {
                    const description = parsed.data.description?.length ? parsed.data.description : null;
                    updates.push({ key: "description", value: description });
                }
                if (hasSubject) {
                    updates.push({ key: "subject", value: parsed.data.subject ?? null });
                }
                if (hasTags) {
                    updates.push({ key: "tags", value: this.parseTags(parsed.data.tags) });
                }
                if (updates.length === 0) {
                    this.sendToastResponse(res, {
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
                this.sendToastResponse(res, {
                    status: 200,
                    message: "Baralho atualizado com sucesso!",
                    variant: "success",
                });
            }
            catch (error) {
                this.handleUnexpectedError("Failed to update deck", error, res);
            }
        };
        this.handleDeleteDeck = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const { deckId } = req.params;
            try {
                const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
                if (!deck) {
                    this.sendToastResponse(res, {
                        status: 404,
                        message: "Baralho não encontrado.",
                        variant: "danger",
                    });
                    return;
                }
                await flashcardModel.delete({
                    params: [
                        { key: "deck_id", value: deckId },
                        { key: "user_id", value: user.id },
                    ],
                });
                await deckModel.delete({
                    params: [
                        { key: "id", value: deckId },
                        { key: "user_id", value: user.id },
                    ],
                });
                this.sendToastResponse(res, {
                    status: 200,
                    message: "Baralho removido com sucesso.",
                    variant: "success",
                });
            }
            catch (error) {
                this.handleUnexpectedError("Failed to delete deck", error, res);
            }
        };
        this.handleCreateCard = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const { deckId } = req.params;
            const createCardSchema = z.object({
                question: z.string().trim().min(1, "Informe pergunta e resposta para criar uma carta."),
                answer: z.string().trim().min(1, "Informe pergunta e resposta para criar uma carta."),
                difficulty: z.string().optional(),
                tags: z.union([z.array(z.string()), z.string()]).optional(),
            });
            const parsed = createCardSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
                this.sendToastResponse(res, { status: 400, message, variant: "danger" });
                return;
            }
            const question = parsed.data.question;
            const answer = parsed.data.answer;
            const difficulty = this.normalizeDifficulty(parsed.data.difficulty);
            const tags = this.parseTags(parsed.data.tags);
            try {
                const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
                if (!deck) {
                    this.sendToastResponse(res, {
                        status: 404,
                        message: "Baralho não encontrado.",
                        variant: "danger",
                    });
                    return;
                }
                const cardId = UuidGeneratorAdapter.generate();
                await flashcardModel.insert({
                    fields: [
                        { key: "id", value: cardId },
                        { key: "question", value: question },
                        { key: "answer", value: answer },
                        { key: "user_id", value: user.id },
                        { key: "deck_id", value: deckId },
                        { key: "status", value: "new" },
                        { key: "review_count", value: 0 },
                        { key: "last_review_date", value: null },
                        { key: "difficulty", value: difficulty },
                        { key: "tags", value: tags },
                    ],
                });
                const newCard = (await flashcardModel.findOne({
                    params: [
                        { key: "id", value: cardId },
                        { key: "deck_id", value: deckId },
                        { key: "user_id", value: user.id },
                    ],
                }));
                const html = await this.renderCard({ card: newCard, deck: deck });
                res
                    .status(201)
                    .setHeader("Content-Type", "text/html; charset=utf-8")
                    .send(html);
            }
            catch (error) {
                this.handleUnexpectedError("Failed to create card", error, res);
            }
        };
        this.handleUpdateCard = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
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
                    this.sendToastResponse(res, {
                        status: 404,
                        message: "Carta não encontrada.",
                        variant: "danger",
                    });
                    return;
                }
                const updateCardSchema = z.object({
                    question: z.string().trim().min(1, "A pergunta não pode ficar vazia.").optional(),
                    answer: z.string().trim().min(1, "A resposta não pode ficar vazia.").optional(),
                    difficulty: z.string().optional(),
                    tags: z.union([z.array(z.string()), z.string()]).optional(),
                    nextReviewDate: z.string().optional(),
                });
                const parsed = updateCardSchema.safeParse(req.body ?? {});
                if (!parsed.success) {
                    const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
                    this.sendToastResponse(res, { status: 400, message, variant: "danger" });
                    return;
                }
                const updates = [];
                const hasQuestion = Object.prototype.hasOwnProperty.call(parsed.data, "question");
                const hasAnswer = Object.prototype.hasOwnProperty.call(parsed.data, "answer");
                const hasDifficulty = Object.prototype.hasOwnProperty.call(parsed.data, "difficulty");
                const hasTags = Object.prototype.hasOwnProperty.call(parsed.data, "tags");
                const hasNextReviewDate = Object.prototype.hasOwnProperty.call(parsed.data, "nextReviewDate");
                if (hasQuestion && parsed.data.question) {
                    updates.push({ key: "question", value: parsed.data.question });
                }
                if (hasAnswer && parsed.data.answer) {
                    updates.push({ key: "answer", value: parsed.data.answer });
                }
                if (hasDifficulty) {
                    updates.push({ key: "difficulty", value: this.normalizeDifficulty(parsed.data.difficulty) });
                }
                if (hasTags) {
                    updates.push({ key: "tags", value: this.parseTags(parsed.data.tags) });
                }
                if (hasNextReviewDate) {
                    const parsedDate = parsed.data.nextReviewDate ? new Date(parsed.data.nextReviewDate) : new Date();
                    updates.push({ key: "next_review_date", value: parsedDate.toISOString() });
                }
                if (updates.length !== 0) {
                    await flashcardModel.update({ id: cardId, fields: updates });
                }
                const newCard = (await flashcardModel.findOne({
                    params: [
                        { key: "id", value: cardId },
                        { key: "deck_id", value: deckId },
                        { key: "user_id", value: user.id },
                    ],
                }));
                const deck = (await deckModel.findOne({
                    params: [{ key: "id", value: deckId }],
                }));
                const html = await this.renderCard({ card: newCard, deck: deck });
                res
                    .status(200)
                    .setHeader("Content-Type", "text/html; charset=utf-8")
                    .send(html);
            }
            catch (error) {
                this.handleUnexpectedError("Failed to update card", error, res);
            }
        };
        this.handleMoveCardToReview = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
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
                    this.sendToastResponse(res, {
                        status: 404,
                        message: "Carta não encontrada.",
                        variant: "danger",
                    });
                    return;
                }
                await flashcardModel.updateNextReviewDateToNow(cardId);
                res
                    .status(200)
                    .setHeader("Content-Type", "text/html; charset=utf-8")
                    .send(`
          <span class="badge text-bg-warning d-inline-flex align-items-center gap-1">
            <i class="bi bi-exclamation-triangle-fill"></i>
            Revisão pendente
          </span>
        `);
                return;
            }
            catch (error) {
                this.handleUnexpectedError("Erro ao mover carta para revisão", error, res);
            }
        };
        this.handleDeleteCard = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
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
                    this.sendToastResponse(res, {
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
                this.sendToastResponse(res, {
                    status: 200,
                    message: "Carta removida com sucesso.",
                    variant: "success",
                });
            }
            catch (error) {
                this.handleUnexpectedError("Failed to delete card", error, res);
            }
        };
        this.handleGenerateCards = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const { deckId } = req.params;
            const generateCardsSchema = z.object({
                content: z
                    .string()
                    .trim()
                    .min(1, "Cole algum conteúdo para que possamos gerar sugestões.")
                    .max(10000, "Use no máximo 10000 caracteres para gerar sugestões."),
                goal: z.string().trim().optional(),
                tone: z.enum(["concise", "standard", "deep"]).optional(),
            });
            const parsed = generateCardsSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
                res
                    .status(400)
                    .setHeader("Content-Type", "text/html; charset=utf-8")
                    .send(`<div class="alert alert-danger" role="alert">${message}</div>`);
                return;
            }
            let processId = null;
            try {
                const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
                if (!deck) {
                    res
                        .status(404)
                        .setHeader("Content-Type", "text/html; charset=utf-8")
                        .send('<div class="alert alert-danger" role="alert">Baralho não encontrado.</div>');
                    return;
                }
                const content = parsed.data.content;
                const goal = parsed.data.goal?.length ? parsed.data.goal : undefined;
                const tone = this.normalizeTone(parsed.data.tone);
                processId = UuidGeneratorAdapter.generate();
                await cardGenerationProcessModel.insert({
                    fields: [
                        { key: "id", value: processId },
                        { key: "user_id", value: user.id },
                        { key: "deck_id", value: deckId },
                        { key: "status", value: "processing" },
                    ],
                });
                await deckGenerationQueue.enqueue({
                    processId,
                    deckId,
                    deckName: deck.name,
                    deckSubject: deck.subject ?? "Geral",
                    userId: user.id,
                    content,
                    goal,
                    tone,
                });
                res
                    .status(202)
                    .setHeader("Content-Type", "text/html; charset=utf-8")
                    .send(this.buildProcessingNoticeMarkup(deck.id));
            }
            catch (error) {
                if (processId) {
                    try {
                        await cardGenerationProcessModel.deleteById(processId);
                    }
                    catch (cleanupError) {
                        console.error("Failed to rollback card generation process", cleanupError);
                    }
                }
                console.error("Failed to enqueue AI suggestion", error);
                res
                    .status(500)
                    .setHeader("Content-Type", "text/html; charset=utf-8")
                    .send('<div class="alert alert-danger" role="alert">Não foi possível enviar para processamento. Tente novamente mais tarde.</div>');
            }
        };
        this.cardGenerator = new DeckCardGeneratorService();
    }
    registerRoutes() {
        this.router.post("/decks", this.handleCreateDeck);
        this.router.put("/decks/:deckId", this.handleUpdateDeck);
        this.router.delete("/decks/:deckId", this.handleDeleteDeck);
        this.router.post("/decks/:deckId/cards", this.handleCreateCard);
        this.router.put("/decks/:deckId/cards/:cardId", this.handleUpdateCard);
        this.router.delete("/decks/:deckId/cards/:cardId", this.handleDeleteCard);
        this.router.post("/decks/:deckId/cards/:cardId/move-to-review", this.handleMoveCardToReview);
        this.router.post("/decks/:deckId/generate", deckGenerateRateLimiter, this.handleGenerateCards);
    }
    createDeckBaseSchema() {
        return z.object({
            name: z.string().trim(),
            description: z.string().trim().optional(),
            subject: z.string().trim(),
            tags: z.union([z.array(z.string()), z.string()]).optional(),
        });
    }
    buildDeckParams(data) {
        return {
            name: data.name,
            description: data.description?.length ? data.description : null,
            subject: data.subject,
            tags: this.parseTags(data.tags),
        };
    }
    ensureDeckBelongsToUser(deckId, userId) {
        return deckModel.findOne({
            params: [
                { key: "id", value: deckId },
                { key: "user_id", value: userId },
            ],
        });
    }
    async renderCard(data) {
        const viewPath = path.join(process.cwd(), "src", "presentation", "views", "app", "card.ejs");
        return renderFile(viewPath, data, { async: true });
    }
    buildProcessingNoticeMarkup(deckId) {
        return `
      <div class="card border-0 shadow-sm">
        <div class="card-body p-4 d-flex flex-column flex-md-row align-items-md-center gap-3">
          <div class="d-flex align-items-center gap-3">
            <i class="bi bi-arrow-repeat text-primary fs-3"></i>
            <div>
              <p class="mb-1 fw-semibold">Estamos gerando novas cartas para este baralho.</p>
              <p class="mb-0 text-secondary small">Você pode voltar para o baralho e continuar estudando enquanto processamos o conteúdo.</p>
            </div>
          </div>
          <a class="btn btn-outline-primary ms-md-auto" href="/app/decks/${deckId}/cards">
            Voltar para o baralho
          </a>
        </div>
      </div>
    `;
    }
    normalizeTone(value) {
        if (value === "concise" || value === "deep") {
            return value;
        }
        return "standard";
    }
}
