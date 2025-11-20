import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { authMiddleware } from "../../../controllers/middlewares/authMiddleware.ts";
import { DbConnection } from "../../../db/db-connection.ts";
import { deckModel } from "../../../db/models/deck.model.ts";
import { flashcardModel } from "../../../db/models/flashcard.model.ts";
import { integrationModel } from "../../../db/models/integration.model.ts";
import { userModel, UserRow } from "../../../db/models/user.model.ts";

export type FlashcardView = {
  id: string;
  question: string;
  answer: string;
  lastReviewedAt: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
};

export type DeckView = {
  id: string;
  name: string;
  description: string;
  subject: string;
  tags: string[];
  totalCards: number;
  dueCards: number;
  newCards: number;
  progress: number;
  updatedAt: string;
  cards?: FlashcardView[];
};

export type ReviewSession = {
  deckName: string;
  cardNumber: number;
  totalCards: number;
  card: {
    id: string;
    question: string;
    answer: string;
    tags: string[];
    dueIn: string;
  };
  streakInDays: number;
};

export type ProgressIndicator = {
  id: string;
  title: string;
  value: string;
  helperText: string;
  trend: "up" | "down" | "steady";
  trendValue: string;
};

export class AppController extends BaseController {
  private static readonly WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

  constructor(app: Application) {
    super(app, { basePath: "/app", requiresAuth: false });
  }

  protected registerRoutes(): void {
    this.router.get("/", this.redirectToLogin);
    this.router.get("/login", this.renderLogin);
    this.router.get("/register", this.renderRegister);

    this.router.use(authMiddleware);

    this.router.get("/decks", this.renderDecks);
    this.router.get("/decks/:deckId", this.redirectDeckToCards);
    this.router.get("/decks/:deckId/cards", this.renderDeckCards);
    this.router.get("/decks/:deckId/filter-cards", this.renderDeckCardsList);
    this.router.get("/decks/:deckId/import", this.renderDeckImport);
    this.router.get("/review", this.renderReview);
    this.router.get("/progress", this.renderProgress);
    this.router.get("/account", this.renderAccount);
  }

  private redirectToLogin = (_: Request, res: Response) => {
    res.redirect("/app/login");
  };

  private renderLogin = (_: Request, res: Response) => {
    res.render("app/login", { title: "Entrar" });
  };

  private renderRegister = (_: Request, res: Response) => {
    res.render("app/register", { title: "Criar conta" });
  };

  private redirectDeckToCards = (req: Request, res: Response) => {
    res.redirect(`/app/decks/${req.params.deckId}/cards`);
  };

  private renderDecks = async (req: Request, res: Response) => {
    try {
      const data = await this.runInTransaction(async () => {
        const { row: userRow, view: user } = await this.loadCurrentUser(req);
        const deckStats = await deckModel.findDecksWithStats({ userId: userRow.id });
        const decks = deckStats.map((deck) => this.mapDeckStatsToView(deck));
        const dueToday = decks.reduce((total, deck) => total + deck.dueCards, 0);
        const totalCards = decks.reduce((total, deck) => total + deck.totalCards, 0);

        return {
          user,
          decks,
          summary: {
            totalDecks: decks.length,
            dueToday,
            totalCards,
          },
        };
      });

      res.render("app/decks", { title: "Meus baralhos", ...data });
    } catch (error) {
      this.handleRenderError(res, error);
    }
  };

  private renderDeckCards = async (req: Request, res: Response) => {
    try {
      const { deckId } = req.params;
      const query = req.query.q?.toString();
      const difficulty = req.query.difficulty?.toString();

      const data = await this.runInTransaction(async () => {
        const { row: userRow, view: user } = await this.loadCurrentUser(req);
        const deck = await deckModel.findDeckWithStats({ deckId, userId: userRow.id });

        if (!deck) {
          return { user, deck: null };
        }

        const cards = await flashcardModel.findByDeck({
          deckId,
          userId: userRow.id,
          search: query,
          difficulty,
        });

        const deckView: DeckView = {
          ...this.mapDeckStatsToView(deck),
          cards: cards.map((card) => this.mapFlashcardToView(card)),
        };

        return { user, deck: deckView };
      });

      if (!data.deck) {
        res.status(404).render("app/not-found", {
          title: "Baralho não encontrado",
          description: "O baralho selecionado não existe ou foi removido.",
          actionLabel: "Voltar para os baralhos",
          actionHref: "/app/decks",
          user: data.user,
        });
        return;
      }

      res.render("app/cards", {
        title: data.deck.name,
        user: data.user,
        deck: data.deck,
      });
    } catch (error) {
      this.handleRenderError(res, error);
    }
  };

  private renderDeckCardsList = async (req: Request, res: Response) => {
    try {
      const { deckId } = req.params;
      const query = req.query.q?.toString();
      const difficulty = req.query.difficulty?.toString();

      const data = await this.runInTransaction(async () => {
        const { row: userRow, view: user } = await this.loadCurrentUser(req);
        const deck = await deckModel.findDeckWithStats({ deckId, userId: userRow.id });

        if (!deck) {
          return { user, deck: null };
        }

        const cards = await flashcardModel.findByDeck({
          deckId,
          userId: userRow.id,
          search: query,
          difficulty,
        });

        const deckView: DeckView = {
          ...this.mapDeckStatsToView(deck),
          cards: cards.map((card) => this.mapFlashcardToView(card)),
        };

        return { deck: deckView };
      });

      if (!data.deck) {
        res.status(404).render("app/not-found", {
          title: "Baralho não encontrado",
          description: "O baralho selecionado não existe ou foi removido.",
          actionLabel: "Voltar para os baralhos",
          actionHref: "/app/decks",
          user: data.user,
        });
        return;
      }

      res.render("app/cards-list", {
        deck: data.deck,
      });
    } catch (error) {
      this.handleRenderError(res, error);
    }
  };

  private renderDeckImport = async (req: Request, res: Response) => {
    try {
      const { deckId } = req.params;
      const data = await this.runInTransaction(async () => {
        const { row: userRow, view: user } = await this.loadCurrentUser(req);
        const deck = await deckModel.findDeckWithStats({ deckId, userId: userRow.id });

        return { user, deck: deck ? this.mapDeckStatsToView(deck) : null };
      });

      if (!data.deck) {
        res.status(404).render("app/not-found", {
          title: "Baralho não encontrado",
          description: "O baralho selecionado não existe ou foi removido.",
          actionLabel: "Voltar para os baralhos",
          actionHref: "/app/decks",
          user: data.user,
        });
        return;
      }

      res.render("app/import", {
        title: "Adicionar conteúdo",
        deck: data.deck,
        user: data.user,
        suggestions: [
          "Cole anotações de aula para gerar flashcards rapidamente.",
          "Informe objetivos de aprendizagem para personalizar o baralho.",
          "Utilize tópicos separados por parágrafos para melhores resultados.",
        ],
      });
    } catch (error) {
      this.handleRenderError(res, error);
    }
  };

  private renderReview = async (req: Request, res: Response) => {
    try {
      const data = await this.runInTransaction(async () => {
        const { row: userRow, view: user } = await this.loadCurrentUser(req);
        const [nextCard] = await flashcardModel.findDueCards({ userId: userRow.id, limit: 1 });
        const totalDue = await flashcardModel.countDueCards({ userId: userRow.id });

        const session: ReviewSession = nextCard
          ? {
            deckName: nextCard.deck_name,
            cardNumber: Number(nextCard.position ?? 1),
            totalCards: totalDue,
            streakInDays: user.streakInDays,
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
            streakInDays: user.streakInDays,
            card: {
              id: "",
              question: "Nenhuma carta pendente no momento.",
              answer: "Assim que novas cartas estiverem prontas, elas aparecerão aqui.",
              tags: [],
              dueIn: "agora",
            },
          };

        return { user, session };
      });

      res.render("app/review", {
        title: "Revisão",
        ...data,
      });
    } catch (error) {
      this.handleRenderError(res, error);
    }
  };

  private renderProgress = async (req: Request, res: Response) => {
    try {
      const data = await this.runInTransaction(async () => {
        const { row: userRow, view: user } = await this.loadCurrentUser(req);
        const deckStats = await deckModel.findDecksWithStats({ userId: userRow.id });
        const decks = deckStats.map((deck) => this.mapDeckStatsToView(deck));
        const historyRows = await flashcardModel.getReviewHistory({ userId: userRow.id, days: 6 });
        const history = this.formatHistory(historyRows);
        const focus = this.formatFocus(decks);

        const { total, mastered } = await flashcardModel.countByStatus({ userId: userRow.id });
        const accuracy = total === 0 ? 0 : Math.round((mastered / total) * 100);
        const reviewedLast30 = await flashcardModel.countReviewedSince({
          userId: userRow.id,
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        });
        const dueToday = decks.reduce((totalDecks, deck) => totalDecks + deck.dueCards, 0);

        const indicators: ProgressIndicator[] = [
          {
            id: "accuracy",
            title: "Taxa de acertos",
            value: `${accuracy}%`,
            helperText: "baseado em cartas dominadas",
            trend: accuracy >= 70 ? "up" : "steady",
            trendValue: accuracy >= 70 ? "+7%" : "estável",
          },
          {
            id: "streak",
            title: "Dias consecutivos",
            value: `${user.streakInDays}`,
            helperText: "sequência ativa",
            trend: user.streakInDays > 0 ? "up" : "steady",
            trendValue: user.streakInDays > 0 ? "+1" : "estável",
          },
          {
            id: "studied",
            title: "Cartas estudadas",
            value: `${reviewedLast30}`,
            helperText: "nos últimos 30 dias",
            trend: reviewedLast30 > 0 ? "up" : "steady",
            trendValue: reviewedLast30 > 0 ? `+${reviewedLast30}` : "estável",
          },
          {
            id: "due",
            title: "Revisões de hoje",
            value: `${dueToday}`,
            helperText: "distribuídas em seus baralhos",
            trend: dueToday > 0 ? "down" : "steady",
            trendValue: dueToday > 0 ? `-${Math.min(dueToday, 5)}` : "estável",
          },
        ];

        return { user, indicators, history, focus };
      });

      res.render("app/progress", {
        title: "Indicadores",
        ...data,
      });
    } catch (error) {
      this.handleRenderError(res, error);
    }
  };

  private renderAccount = async (req: Request, res: Response) => {
    try {
      res.render("app/account", {
        title: "Minha conta",
        ... {
          user: this.getAuthenticatedUser(req)
        }
      });
    } catch (error) {
      this.handleRenderError(res, error);
    }
  };

  private async runInTransaction<T>(handler: () => Promise<T>) {
    await DbConnection.open();
    try {
      const result = await handler();
      await DbConnection.commit();
      return result;
    } catch (error) {
      await DbConnection.rollback();
      throw error;
    }
  }

  private async loadCurrentUser(req: Request) {
    const user = await this.getAuthenticatedUser(req);

    if (!user) {
      throw new Error("Nenhum usuário cadastrado");
    }

    return { row: user as UserRow, view: this.buildUserView(user as UserRow) };
  }

  private buildUserView(user: UserRow) {
    const fallbackAvatar = user.name
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`
      : "https://ui-avatars.com/api/?name=EducaIA";

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan ?? "Gratuito",
      timezone: user.timezone ?? "America/Sao_Paulo",
      avatar: user.avatar_url ?? fallbackAvatar,
      streakInDays: user.streak_in_days ?? 0,
      goalPerDay: user.goal_per_day ?? 0,
    };
  }

  private mapDeckStatsToView(deck: any): DeckView {
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description ?? "Sem descrição",
      subject: deck.subject ?? "Geral",
      tags: Array.isArray(deck.tags) ? deck.tags : [],
      totalCards: Number(deck.total_cards ?? 0),
      dueCards: Number(deck.due_cards ?? 0),
      newCards: Number(deck.new_cards ?? 0),
      progress: Number(deck.progress ?? 0),
      updatedAt: new Date(deck.updated_at).toISOString(),
    };
  }

  private mapFlashcardToView(card: any): FlashcardView {
    return {
      id: card.id,
      question: card.question,
      answer: card.answer,
      lastReviewedAt: new Date(card.last_review_date ?? card.created_at).toISOString(),
      difficulty: (card.difficulty ?? "medium") as "easy" | "medium" | "hard",
      tags: Array.isArray(card.tags) ? card.tags : [],
    };
  }

  private formatHistory(historyRows: any[]) {
    return historyRows.map((row) => {
      const date = new Date(row.day);
      const label = AppController.WEEKDAY_LABELS[date.getDay()];
      return {
        label,
        reviewed: Number(row.reviewed ?? 0),
        created: Number(row.created ?? 0),
      };
    });
  }

  private formatFocus(decks: DeckView[]) {
    const totalCards = decks.reduce((acc, deck) => acc + deck.totalCards, 0) || 1;
    const focusMap = new Map<string, number>();

    decks.forEach((deck) => {
      const subject = deck.subject ?? "Geral";
      focusMap.set(subject, (focusMap.get(subject) ?? 0) + deck.totalCards);
    });

    return Array.from(focusMap.entries()).map(([subject, count]) => ({
      subject,
      percentage: Math.round((count / totalCards) * 100),
    }));
  }

  private formatDueIn(date: Date | string | null) {
    if (!date) {
      return "agora";
    }
    const dueDate = typeof date === "string" ? new Date(date) : date;
    const diffMs = dueDate.getTime() - Date.now();
    if (diffMs <= 0) {
      return "agora";
    }
    const diffMinutes = Math.round(diffMs / (60 * 1000));
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} h`;
    }
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} d`;
  }

  private handleRenderError(res: Response, error: unknown) {
    console.error(error);
    res.status(500).send("Não foi possível carregar os dados solicitados.");
  }
}
