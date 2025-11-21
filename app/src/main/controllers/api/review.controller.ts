import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { flashcardModel, FlashcardRow } from "../../../db/models/flashcard.model.ts";
import { userModel } from "../../../db/models/user.model.ts";

export class ReviewController extends BaseController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.post("/review/grade", this.handleGradeCard);
    this.router.get("/review/hint", this.handleHint);
    this.router.get("/insights", this.handleInsights);
  }

  private handleGradeCard = async (req: Request, res: Response) => {
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
      })) as FlashcardRow | null;

      if (!card) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Carta não encontrada.",
          variant: "danger",
        });
        return;
      }

      const nextReview = this.computeNextReviewDate(
        difficulty,
        card.review_count ?? 0,
      );

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

      if (isFirstReviewToday) {
        const currentStreak = user.streak_in_days ?? 0;
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);

        const isConsecutiveDay =
          !!lastReviewDate && lastReviewDate >= yesterday && lastReviewDate < startOfToday;

        await userModel.update({
          id: user.id,
          fields: [{ key: "streak_in_days", value: isConsecutiveDay ? currentStreak + 1 : 1 }],
        });
      }

      // Force the review page to refresh so the next card is displayed immediately
      res.setHeader("HX-Refresh", "true");

      this.sendToastResponse(res, {
        status: 200,
        message: "Progresso registrado! Continue avançando.",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to grade card", error, res);
    }
  };

  private handleHint = (req: Request, res: Response) => {
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

  private handleInsights = (req: Request, res: Response) => {
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
