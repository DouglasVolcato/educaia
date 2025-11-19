import { BaseController } from "../base.controller.js";
import { flashcardModel } from "../../../db/models/flashcard.model.js";
export class ReviewController extends BaseController {
    constructor(app) {
        super(app);
        this.handleGradeCard = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const cardId = req.body?.cardId?.toString();
            const difficulty = this.normalizeDifficulty(req.body?.difficulty);
            if (!cardId) {
                this.sendToastResponse(res, {
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
                    this.sendToastResponse(res, {
                        status: 404,
                        message: "Carta não encontrada.",
                        variant: "danger",
                    });
                    return;
                }
                const nextReview = this.computeNextReviewDate(difficulty);
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
                this.sendToastResponse(res, {
                    status: 200,
                    message: "Progresso registrado! Continue avançando.",
                    variant: "success",
                });
            }
            catch (error) {
                this.handleUnexpectedError("Failed to grade card", error, res);
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
}
