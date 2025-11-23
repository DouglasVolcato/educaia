import { flashcardModel } from "../../db/models/flashcard.model.js";
import { BaseController } from "../base-controller.js";
import { renderFile } from "ejs";
import { z } from "zod";
import path from "path";
export class ReviewController extends BaseController {
    constructor(app) {
        super(app);
        this.handleGradeCard = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const gradeCardSchema = z.object({
                cardId: z.string().trim().min(1, "Informe a carta que deseja avaliar."),
                difficulty: z
                    .string()
                    .optional()
                    .transform((value) => (value === "easy" || value === "hard" || value === "medium" ? value : "medium")),
            });
            const parsed = gradeCardSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
                this.sendToastResponse(res, { status: 400, message, variant: "danger" });
                return;
            }
            const cardId = parsed.data.cardId;
            const difficulty = this.normalizeDifficulty(parsed.data.difficulty);
            try {
                const card = (await flashcardModel.findOne({
                    params: [
                        { key: "id", value: cardId },
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
                const nextReview = this.computeNextReviewDate(difficulty, card.review_count ?? 0);
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const reviewsToday = await flashcardModel.countReviewedSince({
                    userId: user.id,
                    since: startOfToday,
                });
                const isFirstReviewToday = reviewsToday === 0;
                const lastReviewDate = await flashcardModel.getLastReviewDate({ userId: user.id });
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
                const view = await this.buildReviewView(user.id);
                const html = await this.renderReviewBody(view);
                res
                    .status(200)
                    .setHeader("Content-Type", "text/html; charset=utf-8")
                    .send(html);
            }
            catch (error) {
                this.handleUnexpectedError("Erro ao avaliar carta", error, res);
            }
        };
        this.handleHint = (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const hints = [
                "Explique a carta com suas próprias palavras para consolidar o aprendizado.",
                "Relacione o conteúdo com experiências pessoais para criar memórias duradouras.",
                "Intercale cartas fáceis e difíceis para evitar fadiga cognitiva.",
            ];
            const hint = hints[Math.floor(Math.random() * hints.length)];
            this.sendToastResponse(res, {
                status: 200,
                message: hint,
                variant: "info",
            });
        };
        this.handleInsights = (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const insights = [
                "Dedique os próximos 15 minutos aos baralhos com mais cartas pendentes para destravar progresso imediato.",
                "Experimente revisar cartas antigas antes de criar novas para reforçar a retenção.",
                "Suas revisões matinais têm melhor desempenho: planeje sessões curtas logo ao acordar.",
            ];
            const insight = insights[Math.floor(Math.random() * insights.length)];
            this.sendToastResponse(res, {
                status: 200,
                message: insight,
                variant: "info",
            });
        };
    }
    registerRoutes() {
        this.router.post("/review/grade", this.handleGradeCard);
        this.router.get("/review/hint", this.handleHint);
        this.router.get("/insights", this.handleInsights);
    }
    async buildReviewView(userId) {
        const dueCards = await flashcardModel.findDueCards({ userId, limit: 5 });
        const [nextCard, ...upcomingCards] = dueCards;
        const totalDue = await flashcardModel.countDueCards({ userId });
        const session = nextCard
            ? {
                deckName: nextCard.deck_name,
                cardNumber: Number(nextCard.position ?? 1),
                totalCards: totalDue,
                card: {
                    id: nextCard.id,
                    question: nextCard.question,
                    answer: nextCard.answer,
                    tags: nextCard.tags ?? [],
                    dueIn: this.formatDueIn(nextCard.next_review_date),
                },
            }
            : {
                deckName: "Você está em dia!",
                cardNumber: 0,
                totalCards: 0,
                card: {
                    id: "",
                    question: "Nenhuma carta pendente no momento.",
                    answer: "Assim que novas cartas estiverem prontas, elas aparecerão aqui.",
                    tags: [],
                    dueIn: "agora",
                },
            };
        const nextReviews = upcomingCards.map((card) => ({
            id: card.id,
            question: card.question,
            dueIn: this.formatDueIn(card.next_review_date),
        }));
        return { session, nextReviews };
    }
    async renderReviewBody(data) {
        const viewPath = path.join(process.cwd(), "src", "presentation", "views", "app", "review-session.ejs");
        return renderFile(viewPath, data, { async: true });
    }
    formatDueIn(nextReviewDate) {
        if (!nextReviewDate) {
            return "agora";
        }
        const now = new Date();
        const date = new Date(nextReviewDate);
        const diffMs = date.getTime() - now.getTime();
        const diffMinutes = Math.max(Math.round(diffMs / (1000 * 60)), 0);
        if (diffMinutes <= 0) {
            return "agora";
        }
        if (diffMinutes < 60) {
            return `em ${diffMinutes} min`;
        }
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) {
            return `em ${diffHours} h`;
        }
        const diffDays = Math.round(diffHours / 24);
        return `em ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
    }
}
