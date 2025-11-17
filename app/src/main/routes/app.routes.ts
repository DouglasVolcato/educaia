import { Request, Response, Router } from "express";

type Flashcard = {
  id: string;
  question: string;
  answer: string;
  lastReviewedAt: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
};

type Deck = {
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
  cards: Flashcard[];
};

type ReviewCard = {
  id: string;
  question: string;
  answer: string;
  source: string;
  tags: string[];
  dueIn: string;
};

type ReviewSession = {
  deckName: string;
  cardNumber: number;
  totalCards: number;
  card: ReviewCard;
  streakInDays: number;
};

type ProgressIndicator = {
  id: string;
  title: string;
  value: string;
  helperText: string;
  trend: "up" | "down" | "steady";
  trendValue: string;
};

const mockUser = {
  name: "Ana Paula",
  email: "ana.paula@example.com",
  plan: "Premium",
  timezone: "America/Sao_Paulo",
  avatar: "https://ui-avatars.com/api/?name=Ana+Paula",
  streakInDays: 12,
  goalPerDay: 20,
};

const mockDecks: Deck[] = [
  {
    id: "1",
    name: "Matemática Básica",
    description: "Conceitos fundamentais de álgebra, aritmética e geometria.",
    subject: "Matemática",
    tags: ["Matemática", "Álgebra"],
    totalCards: 42,
    dueCards: 8,
    newCards: 5,
    progress: 68,
    updatedAt: "2024-02-10",
    cards: [
      {
        id: "1",
        question: "Qual é a fórmula da soma dos termos de uma progressão aritmética?",
        answer:
          "Sₙ = (a₁ + aₙ) * n / 2, onde a₁ é o primeiro termo, aₙ o último termo e n a quantidade de termos.",
        lastReviewedAt: "2024-02-11",
        difficulty: "medium",
        tags: ["PA", "Fórmulas"],
      },
      {
        id: "2",
        question: "Como calcular a área de um triângulo equilátero?",
        answer: "Área = (lado² * √3) / 4.",
        lastReviewedAt: "2024-02-09",
        difficulty: "easy",
        tags: ["Geometria"],
      },
      {
        id: "3",
        question: "O que representa o discriminante em uma equação quadrática?",
        answer:
          "O discriminante (Δ = b² - 4ac) indica o número de raízes reais da equação quadrática.",
        lastReviewedAt: "2024-02-05",
        difficulty: "hard",
        tags: ["Equações", "Δ"],
      },
    ],
  },
  {
    id: "2",
    name: "História do Brasil",
    description: "Eventos marcantes do período colonial ao Brasil contemporâneo.",
    subject: "História",
    tags: ["História", "Brasil"],
    totalCards: 58,
    dueCards: 12,
    newCards: 3,
    progress: 52,
    updatedAt: "2024-02-08",
    cards: [
      {
        id: "1",
        question: "Quais foram as principais causas da Inconfidência Mineira?",
        answer:
          "Altos impostos cobrados pela Coroa Portuguesa e o desejo de independência da elite intelectual mineira.",
        lastReviewedAt: "2024-02-10",
        difficulty: "medium",
        tags: ["Colônia", "Minas Gerais"],
      },
      {
        id: "2",
        question: "O que foi o Estado Novo?",
        answer:
          "Período de governo de Getúlio Vargas iniciado em 1937 caracterizado por forte centralização do poder.",
        lastReviewedAt: "2024-02-07",
        difficulty: "hard",
        tags: ["Era Vargas"],
      },
      {
        id: "3",
        question: "Quem foram os primeiros habitantes do território brasileiro?",
        answer: "Diversos povos indígenas com culturas e línguas distintas.",
        lastReviewedAt: "2024-02-03",
        difficulty: "easy",
        tags: ["Povos originários"],
      },
    ],
  },
  {
    id: "3",
    name: "Inglês para Viagem",
    description: "Vocabulário e expressões essenciais para situações no exterior.",
    subject: "Idiomas",
    tags: ["Inglês", "Conversação"],
    totalCards: 24,
    dueCards: 2,
    newCards: 10,
    progress: 34,
    updatedAt: "2024-02-12",
    cards: [
      {
        id: "1",
        question: "Como perguntar onde fica o banheiro em inglês?",
        answer: "Excuse me, where is the restroom?",
        lastReviewedAt: "2024-02-12",
        difficulty: "easy",
        tags: ["Vocabulário"],
      },
      {
        id: "2",
        question: "Qual expressão utilizar para pedir a conta em um restaurante?",
        answer: "Could I get the check, please?",
        lastReviewedAt: "2024-02-11",
        difficulty: "medium",
        tags: ["Restaurante"],
      },
      {
        id: "3",
        question: "Como oferecer ajuda a alguém em inglês?",
        answer: "Can I give you a hand?",
        lastReviewedAt: "2024-02-09",
        difficulty: "easy",
        tags: ["Expressões"],
      },
    ],
  },
];

const mockReviewSession: ReviewSession = {
  deckName: "Matemática Básica",
  cardNumber: 3,
  totalCards: 15,
  streakInDays: 12,
  card: {
    id: "2",
    question: "Qual é a diferença entre permutação, arranjo e combinação?",
    answer:
      "Permutação reorganiza todos os elementos, arranjo considera ordem em subconjuntos e combinação desconsidera a ordem.",
    source: "Resumo do capítulo 4 do livro de Matemática Discreta",
    tags: ["Análise combinatória", "Probabilidade"],
    dueIn: "4 horas",
  },
};

const mockIndicators: ProgressIndicator[] = [
  {
    id: "accuracy",
    title: "Taxa de acertos",
    value: "87%",
    helperText: "nas últimas 2 semanas",
    trend: "up",
    trendValue: "+4%",
  },
  {
    id: "streak",
    title: "Dias consecutivos",
    value: `${mockUser.streakInDays}`,
    helperText: "meta: 30 dias",
    trend: "steady",
    trendValue: "mantido",
  },
  {
    id: "studied",
    title: "Cartas estudadas",
    value: "186",
    helperText: "no último mês",
    trend: "up",
    trendValue: "+28",
  },
  {
    id: "due",
    title: "Revisões de hoje",
    value: "12",
    helperText: "distribuídas em 3 baralhos",
    trend: "down",
    trendValue: "-5",
  },
];

const mockProgressHistory = [
  { label: "Seg", reviewed: 18, created: 4 },
  { label: "Ter", reviewed: 22, created: 6 },
  { label: "Qua", reviewed: 16, created: 3 },
  { label: "Qui", reviewed: 20, created: 5 },
  { label: "Sex", reviewed: 24, created: 7 },
  { label: "Sáb", reviewed: 12, created: 2 },
  { label: "Dom", reviewed: 10, created: 1 },
];

const mockLearningFocus = [
  { subject: "Matemática", percentage: 45 },
  { subject: "História", percentage: 32 },
  { subject: "Idiomas", percentage: 23 },
];

const appRouter = Router();

appRouter.get("/", (req: Request, res: Response) => {
  res.redirect("/app/login");
});

appRouter.get("/login", (req: Request, res: Response) => {
  res.render("app/login", {
    title: "Entrar",
  });
});

appRouter.get("/register", (req: Request, res: Response) => {
  res.render("app/register", {
    title: "Criar conta",
  });
});

appRouter.get("/decks", (req: Request, res: Response) => {
  const dueToday = mockDecks.reduce((total, deck) => total + deck.dueCards, 0);
  const totalCards = mockDecks.reduce((total, deck) => total + deck.totalCards, 0);

  res.render("app/decks", {
    title: "Meus baralhos",
    user: mockUser,
    decks: mockDecks,
    summary: {
      totalDecks: mockDecks.length,
      dueToday,
      totalCards,
    },
  });
});

appRouter.get("/decks/:deckId", (req: Request, res: Response) => {
  res.redirect(`/app/decks/${req.params.deckId}/cards`);
});

appRouter.get("/decks/:deckId/cards", (req: Request, res: Response) => {
  const deck = mockDecks.find((item) => item.id === req.params.deckId);

  if (!deck) {
    res.status(404).render("app/not-found", {
      title: "Baralho não encontrado",
      description: "O baralho selecionado não existe ou foi removido.",
      actionLabel: "Voltar para os baralhos",
      actionHref: "/app/decks",
      user: mockUser,
    });
    return;
  }

  res.render("app/cards", {
    title: deck.name,
    user: mockUser,
    deck,
  });
});

appRouter.get("/decks/:deckId/import", (req: Request, res: Response) => {
  const deck = mockDecks.find((item) => item.id === req.params.deckId);

  if (!deck) {
    res.status(404).render("app/not-found", {
      title: "Baralho não encontrado",
      description: "O baralho selecionado não existe ou foi removido.",
      actionLabel: "Voltar para os baralhos",
      actionHref: "/app/decks",
      user: mockUser,
    });
    return;
  }

  res.render("app/import", {
    title: "Adicionar conteúdo",
    deck,
    user: mockUser,
    suggestions: [
      "Cole anotações de aula para gerar flashcards rapidamente.",
      "Informe objetivos de aprendizagem para personalizar o baralho.",
      "Utilize tópicos separados por parágrafos para melhores resultados.",
    ],
  });
});

appRouter.get("/review", (req: Request, res: Response) => {
  res.render("app/review", {
    title: "Revisão",
    session: mockReviewSession,
    user: mockUser,
  });
});

appRouter.get("/progress", (req: Request, res: Response) => {
  res.render("app/progress", {
    title: "Indicadores",
    user: mockUser,
    indicators: mockIndicators,
    history: mockProgressHistory,
    focus: mockLearningFocus,
  });
});

appRouter.get("/account", (req: Request, res: Response) => {
  res.render("app/account", {
    title: "Minha conta",
    user: mockUser,
    preferences: {
      reminderEmail: true,
      reminderPush: true,
      weeklySummary: true,
      aiSuggestions: false,
    },
    integrations: [
      { id: "calendar", name: "Google Calendar", connected: true },
      { id: "notion", name: "Notion", connected: false },
      { id: "drive", name: "Google Drive", connected: true },
    ],
  });
});

export { appRouter };
