import { FlashcardFormatterTool } from "./tools/flashcard-formatter.tool.ts";
import { LlmAgent, MessageSenderEnum } from "./agent.ts";

export type GeneratedFlashcard = {
  question: string;
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
};

type GenerateCardsInput = {
  deckName: string;
  deckSubject: string;
  goal?: string | null;
  tone?: "concise" | "standard" | "deep";
  content: string;
};

type GenerateCardsOutput = {
  cards: GeneratedFlashcard[];
};

export class DeckCardGeneratorService {
  private readonly agentFactory: () => LlmAgent;

  constructor(agentFactory: () => LlmAgent = () => new LlmAgent()) {
    this.agentFactory = agentFactory;
  }

  public async generateCards(input: GenerateCardsInput): Promise<GenerateCardsOutput> {
    const agent = this.agentFactory();
    const tool = new FlashcardFormatterTool();
    const toolInstance = tool.getInstance();
    agent.addTool(toolInstance);

    agent.addMessage({
      role: MessageSenderEnum.SYSTEM,
      content:
        `Você é um especialista em educação que cria flashcards estilo pergunta e resposta para revisão espaçada. Foque em informações importantes, contexto claro e linguagem em português brasileiro.
        Sempre retorne o resultado final chamando a ferramenta format_flashcards. Ela recebe um array com os flashcards e garante que tudo esteja pronto para ser importado pelo aplicativo.`,
    });

    agent.addMessage({
      role: MessageSenderEnum.USER,
      content: this.buildPrompt({ ...input }),
    });

    const response = await agent.getResponse();
    const toolCall = response.toolCalls.find(
      (call) => call.name === FlashcardFormatterTool.NAME,
    );

    if (!toolCall) {
      throw new Error("Erro ao gerar flashcards: " + response.response);
    }

    const parsed = FlashcardFormatterTool.parse(toolCall.input);
    const cards = parsed.cards.map((card) => ({
      question: card.question.trim(),
      answer: card.answer.trim(),
      difficulty: card.difficulty ?? "medium",
      tags: card.tags ?? [],
    }));

    return { cards };
  }

  private buildPrompt(input: GenerateCardsInput) {
    const goal = input.goal?.trim() || "Não informado";
    const toneMap: Record<Required<GenerateCardsInput>["tone"], string> = {
      concise: "Seja direto e destaque apenas os pontos indispensáveis.",
      standard: "Combine explicações objetivas com detalhes que ajudem a lembrar do conceito.",
      deep: "Se aprofunde nas explicações, fornecendo exemplos ou passos relevantes.",
    } as const;

    const toneInstruction = toneMap[input.tone ?? "standard"];

    return `Contexto do baralho:
- Nome: ${input.deckName}
- Assunto central: ${input.deckSubject}
- Objetivo do estudante: ${goal}

${toneInstruction}

Use o conteúdo abaixo para extrair os conceitos principais e transformá-los em flashcards completos. Cada flashcard deve ter pergunta e resposta claras, dificuldade sugerida (easy, medium ou hard) e até 4 tags temáticas curtas.

Conteúdo fornecido:
"""
${input.content.trim()}
"""

Quando terminar, chame a ferramenta format_flashcards enviando todos os flashcards gerados.`;
  }
}
