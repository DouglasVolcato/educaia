import { Application, Request, RequestHandler, Response, Router } from "express";
import { TokenHandlerAdapter } from "../../adapters/token-handler-adapter.ts";
import { SESSION_COOKIE_NAME } from "../../constants/session.ts";
import { authMiddleware } from "../../controllers/middlewares/authMiddleware.ts";
import { defaultRateLimiter } from "./rate-limiters.ts";

type ControllerOptions = {
  basePath?: string;
  requiresAuth?: boolean;
  rateLimiter?: RequestHandler;
};

type ToastVariant = "success" | "danger" | "info";

type ToastResponseOptions = {
  status?: number;
  message: string;
  variant?: ToastVariant;
};

export type AuthenticatedUser = { id: string; name?: string; email?: string };

export abstract class BaseController {
  private static readonly COOKIE_MAX_AGE = 60 * 60 * 1000; // 1 hour
  private static tokenHandler: TokenHandlerAdapter | null = null;
  private static readonly DIFFICULTIES = new Set(["easy", "medium", "hard"]);

  protected readonly router: Router;

  constructor(
    protected readonly app: Application,
    private readonly options: ControllerOptions = {},
  ) {
    this.router = Router();
    this.setupMiddlewares();
    this.deferRouteRegistration();
    this.app.use(this.options.basePath ?? "/api", this.router);
  }

  protected abstract registerRoutes(): void;

  private deferRouteRegistration() {
    queueMicrotask(() => {
      try {
        this.registerRoutes();
      } catch (error) {
        console.error("Failed to register API routes", error);
        throw error;
      }
    });
  }

  private setupMiddlewares() {
    const rateLimiter = this.options.rateLimiter ?? defaultRateLimiter;
    this.router.use(rateLimiter);

    if (this.options.requiresAuth ?? true) {
      this.router.use(authMiddleware);
    }
  }

  private createToastMarkup(message: string, variant: ToastVariant = "info") {
    return `
      <div class="toast show align-items-center text-bg-${variant} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
        </div>
      </div>
    `;
  }

  protected sendToastResponse(res: Response, options: ToastResponseOptions) {
    res
      .status(options.status ?? 200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(this.createToastMarkup(options.message, options.variant));
  }

  protected setSessionCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: BaseController.COOKIE_MAX_AGE,
      path: "/",
    });
  }

  protected getJwtAdapter() {
    if (!BaseController.tokenHandler) {
      BaseController.tokenHandler = new TokenHandlerAdapter();
    }
    return BaseController.tokenHandler;
  }

  protected getAuthenticatedUser(req: Request): AuthenticatedUser | null {
    return (req.body?.user as AuthenticatedUser) ?? null;
  }

  protected ensureAuthenticatedUser(req: Request, res: Response): AuthenticatedUser | null {
    const user = this.getAuthenticatedUser(req);
    if (!user) {
      this.sendToastResponse(res, {
        status: 401,
        message: "Sua sessão expirou. Faça login novamente para continuar.",
        variant: "danger",
      });
      return null;
    }
    return user;
  }

  protected parseTags(value: unknown): string[] {
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
  }

  protected parseCheckbox(value: unknown) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value === "on" || value === "true";
    }
    return Boolean(value);
  }

  protected computeNextReviewDate(
    difficulty: "easy" | "medium" | "hard",
    reviewCount = 0,
  ) {
    const now = new Date();
    const safeReviewCount = Math.max(0, reviewCount);

    if (difficulty === "hard") {
      // mantém a carta no mesmo dia, mas evita que ela bloqueie a fila aparecendo imediatamente
      return new Date(now.getTime() + 60 * 60 * 1000);
    }

    const intervals: Record<"easy" | "medium", number> = {
      easy: 3 + safeReviewCount, // aumenta o espaçamento conforme o histórico de acertos
      medium: 1 + Math.floor(safeReviewCount / 2),
    };

    const days = intervals[difficulty];
    const nextReview = new Date(now);
    nextReview.setDate(now.getDate() + days);
    return nextReview;
  }

  protected normalizeDifficulty(value: unknown): "easy" | "medium" | "hard" {
    if (typeof value === "string" && BaseController.DIFFICULTIES.has(value)) {
      return value as "easy" | "medium" | "hard";
    }
    return "medium";
  }

  protected handleUnexpectedError(context: string, error: unknown, res: Response) {
    console.error(context, error);
    this.sendToastResponse(res, {
      status: 500,
      message: "Ocorreu um erro inesperado. Tente novamente em instantes.",
      variant: "danger",
    });
  }

  protected buildCardPreviewMarkup(deckId: string, cards: { question: string; answer: string }[]) {
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
      .map(
        (card, index) => `
          <div class="card border-0 shadow-sm">
            <div class="card-body p-4 d-grid gap-2">
              <div class="d-flex justify-content-between align-items-center">
                <span class="badge text-bg-primary-subtle text-primary">Flashcard ${index + 1}</span>
                <span class="text-secondary small">Gerado pela IA</span>
              </div>
              <p class="fw-semibold mb-1">${card.question}</p>
              <p class="mb-0 text-secondary">${card.answer}</p>
            </div>
          </div>
        `,
      )
      .join("");

    return `
      <h2 class="h6 text-uppercase text-secondary fw-semibold">Flashcards gerados</h2>
      <div class="d-flex flex-column gap-3">${items}</div>
      <a class="btn btn-primary" href="/app/decks/${deckId}">Ir para o baralho</a>
    `;
  }
}
