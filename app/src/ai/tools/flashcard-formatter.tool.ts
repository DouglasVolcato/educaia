import { z } from "zod";
import { LlmTool, LlmToolType } from "../tool.ts";

export type FlashcardSuggestion = {
  question: string;
  answer: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
};

export type FlashcardFormatterInput = {
  goal?: string;
  cards: FlashcardSuggestion[];
  summary?: string;
};

export class FlashcardFormatterTool extends LlmTool {
  public static readonly NAME = "format_flashcards";

  private static readonly cardSchema = z.object({
    question: z
      .string()
      .min(10, "Forneça perguntas completas e claras."),
    answer: z
      .string()
      .min(10, "Forneça respostas claras e com contexto suficiente."),
    difficulty: z
      .enum(["easy", "medium", "hard"], {
        required_error:
          "Defina a dificuldade como easy, medium ou hard para cada card.",
      })
      .default("medium"),
    tags: z
      .array(z.string().min(1).max(40))
      .max(4)
      .default([]),
  });

  private static readonly schema = z.object({
    goal: z.string().max(200).optional(),
    summary: z.string().max(500).optional(),
    cards: z
      .array(FlashcardFormatterTool.cardSchema)
      .min(1, "Gere ao menos um flashcard."),
  });

  public static parse(input: unknown) {
    const result = FlashcardFormatterTool.schema.safeParse(input);
    if (!result.success) {
      throw new Error(
        "O formato retornado pela IA não é válido para criação de flashcards.",
      );
    }
    return result.data;
  }

  public getInstance(): LlmToolType {
    return {
      name: FlashcardFormatterTool.NAME,
      description:
        "Recebe o conteúdo estudado e retorna um array de flashcards prontos para revisão (pergunta, resposta, dificuldade e tags). Use esta ferramenta para entregar o resultado final ao usuário.",
      schema: FlashcardFormatterTool.schema,
      callback: async (args: FlashcardFormatterInput) => {
        const parsed = FlashcardFormatterTool.parse(args);
        const count = parsed.cards.length;
        return JSON.stringify({
          ...parsed,
          return_message: `Foram preparados ${count} flashcards com base no material enviado.`,
        });
      },
    };
  }
}
