import { Application, Request, Response } from "express";
import { z } from "zod";
import { BaseController } from "../base.controller.ts";
import { deckModel } from "../../../db/models/deck.model.ts";
import { flashcardModel, FlashcardRow } from "../../../db/models/flashcard.model.ts";
import { InputField } from "../../../db/repository.ts";
import { UuidGeneratorAdapter } from "../../../adapters/uuid-generator-adapter.ts";
import { DeckCardGeneratorService } from "../../../ai/deck-card-generator.service.ts";

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
    this.router.post("/decks/:deckId/generate", this.handleGenerateCards);
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

    const schema = z.object({
      name: z.string().trim().min(1, "Informe o nome do baralho."),
      description: z
        .string()
        .trim()
        .transform((value) => (value.length > 0 ? value : null))
        .optional()
        .default(null),
      subject: z.string().trim().min(1, "Informe o assunto do baralho."),
      tags: z.union([z.array(z.string()), z.string()]).optional(),
    });

    const validated = this.validateSchema(schema, req.body, res);
    if (!validated) {
      return;
    }

    const params = {
      ...validated,
      tags: this.parseTags(validated.tags),
    };

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

      const schema = z.object({
        name: z.string().trim().min(1, "O nome do baralho não pode ficar em branco.").optional(),
        description: z
          .string()
          .trim()
          .transform((value) => (value.length > 0 ? value : null))
          .optional(),
        subject: z.string().trim().min(1, "Informe um assunto válido para o baralho.").optional(),
        tags: z.union([z.array(z.string()), z.string()]).optional(),
      });

      const validated = this.validateSchema(schema, req.body, res);
      if (!validated) {
        return;
      }

      const updates: InputField[] = [];

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
        if (!validated.name) {
          this.sendToastResponse(res, {
            status: 400,
            message: "O nome do baralho não pode ficar em branco.",
            variant: "danger",
          });
          return;
        }
        updates.push({ key: "name", value: validated.name });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "description")) {
        updates.push({ key: "description", value: validated.description ?? null });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "subject")) {
        updates.push({ key: "subject", value: validated.subject ?? null });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "tags")) {
        updates.push({ key: "tags", value: this.parseTags(validated.tags) });
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
    const schema = z.object({
      question: z.string().trim().min(1, "Informe a pergunta da carta."),
      answer: z.string().trim().min(1, "Informe a resposta da carta."),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z.union([z.array(z.string()), z.string()]).optional(),
    });

    const validated = this.validateSchema(schema, req.body, res);
    if (!validated) {
      return;
    }

    const difficulty = this.normalizeDifficulty(validated.difficulty);
    const tags = this.parseTags(validated.tags);

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
            { key: "question", value: validated.question },
            { key: "answer", value: validated.answer },
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

      const schema = z.object({
        question: z.string().trim().min(1, "A pergunta não pode ficar vazia.").optional(),
        answer: z.string().trim().min(1, "A resposta não pode ficar vazia.").optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        tags: z.union([z.array(z.string()), z.string()]).optional(),
        nextReviewDate: z
          .coerce.date({ invalid_type_error: "Informe uma data de revisão válida." })
          .optional(),
      });

      const validated = this.validateSchema(schema, req.body, res);
      if (!validated) {
        return;
      }

      const updates: InputField[] = [];

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "question")) {
        if (!validated.question) {
          this.sendToastResponse(res, {
            status: 400,
            message: "A pergunta não pode ficar vazia.",
            variant: "danger",
          });
          return;
        }
        updates.push({ key: "question", value: validated.question });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "answer")) {
        if (!validated.answer) {
          this.sendToastResponse(res, {
            status: 400,
            message: "A resposta não pode ficar vazia.",
            variant: "danger",
          });
          return;
        }
        updates.push({ key: "answer", value: validated.answer });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "difficulty")) {
        updates.push({ key: "difficulty", value: this.normalizeDifficulty(validated.difficulty) });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "tags")) {
        updates.push({ key: "tags", value: this.parseTags(validated.tags) });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "nextReviewDate") && validated.nextReviewDate) {
        updates.push({ key: "next_review_date", value: validated.nextReviewDate.toISOString() });
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
    const schema = z.object({
      content: z
        .string()
        .trim()
        .min(1, "Cole algum conteúdo para que possamos gerar sugestões.")
        .max(10000, "Use no máximo 10000 caracteres para gerar sugestões."),
      goal: z.string().trim().optional().transform((value) => (value && value.length > 0 ? value : undefined)),
      tone: z.enum(["concise", "standard", "deep"]).optional(),
    });

    const validated = this.validateSchema(schema, req.body, res);
    if (!validated) {
      return;
    }

    const tone = this.normalizeTone(validated.tone);

    try {
      const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
      if (!deck) {
        res
          .status(404)
          .setHeader("Content-Type", "text/html; charset=utf-8")
          .send('<div class="alert alert-danger" role="alert">Baralho não encontrado.</div>');
        return;
      }

      const cards = await this.generateCardsWithFallback({
        deckName: deck.name,
        deckSubject: deck.subject ?? "Geral",
        content: validated.content,
        goal: validated.goal,
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
