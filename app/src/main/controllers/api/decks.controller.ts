import { Application, Request, Response } from "express";
import { BaseApiController } from "./base-api.controller.ts";
import { deckModel } from "../../../db/models/deck.model.ts";
import { flashcardModel, FlashcardRow } from "../../../db/models/flashcard.model.ts";
import { InputField } from "../../../db/repository.ts";
import { UuidGeneratorAdapter } from "../../../adapters/uuid-generator-adapter.ts";

export class DecksController extends BaseApiController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.post("/decks", this.handleCreateDeck);
    this.router.put("/decks/:deckId", this.handleUpdateDeck);
    this.router.delete("/decks/:deckId", this.handleDeleteDeck);
    this.router.post("/decks/:deckId/cards", this.handleCreateCard);
    this.router.put("/decks/:deckId/cards/:cardId", this.handleUpdateCard);
    this.router.delete("/decks/:deckId/cards/:cardId", this.handleDeleteCard);
    this.router.post("/decks/:deckId/generate", this.handleGenerateCards);
  }

  private buildDeckParams(req: Request) {
    return {
      name: req.body?.name?.toString()?.trim(),
      description: req.body?.description?.toString()?.trim() ?? null,
      subject: req.body?.subject?.toString()?.trim() ?? null,
      tags: this.parseTags(req.body?.tags),
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

    const params = this.buildDeckParams(req);
    if (!params.name || !params.subject) {
      this.sendToastResponse(res, {
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

      const params = this.buildDeckParams(req);
      const updates: InputField[] = [];

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
        if (!params.name) {
          this.sendToastResponse(res, {
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
    const question = req.body?.question?.toString()?.trim();
    const answer = req.body?.answer?.toString()?.trim();
    const difficulty = this.normalizeDifficulty(req.body?.difficulty);
    const tags = this.parseTags(req.body?.tags);

    if (!question || !answer) {
      this.sendToastResponse(res, {
        status: 400,
        message: "Informe pergunta e resposta para criar uma carta.",
        variant: "danger",
      });
      return;
    }

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
          { key: "next_review_date", value: null },
          { key: "difficulty", value: difficulty },
          { key: "tags", value: tags },
          { key: "source", value: req.body?.source?.toString() ?? "Manual" },
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

      const updates: InputField[] = [];
      const question = req.body?.question?.toString()?.trim();
      const answer = req.body?.answer?.toString()?.trim();

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "question")) {
        if (!question) {
          this.sendToastResponse(res, {
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
          this.sendToastResponse(res, {
            status: 400,
            message: "A resposta não pode ficar vazia.",
            variant: "danger",
          });
          return;
        }
        updates.push({ key: "answer", value: answer });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "difficulty")) {
        updates.push({ key: "difficulty", value: this.normalizeDifficulty(req.body?.difficulty) });
      }

      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "tags")) {
        updates.push({ key: "tags", value: this.parseTags(req.body?.tags) });
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
    const content = req.body?.content?.toString()?.trim();

    if (!content) {
      res
        .status(400)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send('<div class="alert alert-danger" role="alert">Cole algum conteúdo para que possamos gerar sugestões.</div>');
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

      const sections = content
        .split(/\n+/)
        .map((section: string) => section.trim())
        .filter((section: string) => section.length > 0);

      const cards = sections.slice(0, 3).map((section: string) => ({
        question: `Qual é o conceito principal sobre "${section.slice(0, 60)}"?`,
        answer: section.length > 280 ? `${section.slice(0, 277)}...` : section,
      }));

      const createImmediately = this.parseCheckbox(req.body?.createImmediately);

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
          .send(
            `<div class="alert alert-success" role="alert">${cards.length} flashcards foram adicionados diretamente ao baralho.</div>`,
          );
        return;
      }

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(this.buildCardPreviewMarkup(cards));
    } catch (error) {
      console.error("Failed to generate AI suggestion", error);
      res
        .status(500)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send('<div class="alert alert-danger" role="alert">Não foi possível gerar sugestões no momento. Tente novamente mais tarde.</div>');
    }
  };
}
