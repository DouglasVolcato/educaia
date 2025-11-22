import { Application, Request, Response } from "express";
import { z } from "zod";
import { DeckCardGeneratorService } from "../../ai/deck-card-generator.service.ts";
import { UuidGeneratorAdapter } from "../../adapters/uuid-generator-adapter.ts";
import { deckModel } from "../../db/models/deck.model.ts";
import { flashcardModel, FlashcardRow } from "../../db/models/flashcard.model.ts";
import { InputField } from "../../db/repository.ts";
import { BaseController } from "../base-controller.ts";
import { deckGenerateRateLimiter } from "../rate-limiters.ts";

export class DecksController extends BaseController {
  private readonly cardGenerator: DeckCardGeneratorService;

  constructor(app: Application) {
    super(app);
    this.cardGenerator = new DeckCardGeneratorService();
  }

  protected registerRoutes(): void {
    this.router.post("/decks", this.handleCreateDeck);
    this.router.put("/decks/:deckId", this.handleUpdateDeck);
    this.router.delete("/decks/:deckId", this.handleDeleteDeck);
    this.router.post("/decks/:deckId/cards", this.handleCreateCard);
    this.router.put("/decks/:deckId/cards/:cardId", this.handleUpdateCard);
    this.router.delete("/decks/:deckId/cards/:cardId", this.handleDeleteCard);
    this.router.post("/decks/:deckId/cards/:cardId/move-to-review", this.handleMoveCardToReview);
    this.router.post("/decks/:deckId/generate", deckGenerateRateLimiter, this.handleGenerateCards);
  }

  private createDeckBaseSchema() {
    return z.object({
      name: z.string().trim(),
      description: z.string().trim().optional(),
      subject: z.string().trim(),
      tags: z.union([z.array(z.string()), z.string()]).optional(),
    });
  }

  private buildDeckParams(data: z.infer<ReturnType<DecksController["createDeckBaseSchema"]>>) {
    return {
      name: data.name,
      description: data.description?.length ? data.description : null,
      subject: data.subject,
      tags: this.parseTags(data.tags),
    };
  }

  private ensureDeckBelongsToUser(deckId: string, userId: string) {
    return deckModel.findOne({
      params: [
        { key: "id", value: deckId },
        { key: "user_id", value: userId },
      ],
    });
  }

  private handleCreateDeck = async (req: Request, res: Response) => {
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
    } catch (error) {
      this.handleUnexpectedError("Failed to create deck", error, res);
    }
  };

  private handleUpdateDeck = async (req: Request, res: Response) => {
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

      const updates: InputField[] = [];

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
    } catch (error) {
      this.handleUnexpectedError("Failed to update deck", error, res);
    }
  };

  private handleDeleteDeck = async (req: Request, res: Response) => {
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
    } catch (error) {
      this.handleUnexpectedError("Failed to delete deck", error, res);
    }
  };

  private handleCreateCard = async (req: Request, res: Response) => {
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
          { key: "difficulty", value: difficulty },
          { key: "tags", value: tags },
        ],
      });

      this.sendToastResponse(res, {
        status: 201,
        message: "Carta criada com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to create card", error, res);
    }
  };

  private handleUpdateCard = async (req: Request, res: Response) => {
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
      })) as FlashcardRow | null;

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

      const updates: InputField[] = [];

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

      if (updates.length === 0) {
        this.sendToastResponse(res, {
          status: 200,
          message: "Nenhuma alteração foi aplicada nesta carta.",
          variant: "info",
        });
        return;
      }

      await flashcardModel.update({ id: cardId, fields: updates });

      this.sendToastResponse(res, {
        status: 200,
        message: "Carta atualizada com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update card", error, res);
    }
  };

  private handleMoveCardToReview = async (req: Request, res: Response) => {
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
    } catch (error) {
      this.handleUnexpectedError("Erro ao mover carta para revisão", error, res);
    }
  };

  private handleDeleteCard = async (req: Request, res: Response) => {
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
    } catch (error) {
      this.handleUnexpectedError("Failed to delete card", error, res);
    }
  };

  private handleGenerateCards = async (req: Request, res: Response) => {
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

      const cards = await this.generateCardsWithFallback({
        deckName: deck.name,
        deckSubject: deck.subject ?? "Geral",
        content,
        goal,
        tone,
      });

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
            { key: "difficulty", value: suggestion.difficulty ?? "medium" },
            { key: "tags", value: suggestion.tags ?? [] },
          ],
        });
      }

      res
        .status(201)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(this.buildCardPreviewMarkup(deck.id, cards));
    } catch (error) {
      console.error("Failed to generate AI suggestion", error);
      res
        .status(500)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send('<div class="alert alert-danger" role="alert">Não foi possível gerar sugestões no momento. Tente novamente mais tarde.</div>');
    }
  };

  private async generateCardsWithFallback(input: {
    deckName: string;
    deckSubject: string;
    content: string;
    goal?: string | null;
    tone?: "concise" | "standard" | "deep";
  }) {
    const result = await this.cardGenerator.generateCards(input);
    if (result.cards.length > 0) {
      return result.cards;
    } else {
      throw new Error("Erro ao gerar flashcards.");
    }
  }

  private normalizeTone(value: unknown): "concise" | "standard" | "deep" {
    if (value === "concise" || value === "deep") {
      return value;
    }
    return "standard";
  }
}
