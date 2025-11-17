import { Repository } from "@db/repository";

const flashcardFields = [
  "id",
  "question",
  "answer",
  "user_id",
  "deck_id",
  "status",
  "review_count",
  "last_review_date",
  "next_review_date",
  "difficulty",
  "tags",
  "source",
  "created_at",
  "updated_at",
];

export type FlashcardRow = {
  id: string;
  question: string;
  answer: string;
  user_id: string;
  deck_id: string;
  status: string;
  review_count: number | null;
  last_review_date: Date | null;
  next_review_date: Date | null;
  created_at: Date;
  updated_at: Date;
  difficulty: string | null;
  tags: string[] | null;
  source: string | null;
};

export class FlashcardModel extends Repository {
  constructor() {
    super({
      tableName: "flashcards",
      idField: "id",
      publicFields: flashcardFields,
      insertFields: flashcardFields,
      updateFields: [
        "question",
        "answer",
        "status",
        "review_count",
        "last_review_date",
        "next_review_date",
        "difficulty",
        "tags",
        "source",
        "updated_at",
      ],
    });
  }

  public async findByDeck(input: {
    deckId: string;
    userId: string;
    search?: string;
    difficulty?: string;
  }) {
    const filters: string[] = ["deck_id = $1", "user_id = $2"];
    const values: any[] = [input.deckId, input.userId];
    let placeholderIndex = 3;

    if (input.search) {
      filters.push(`(question ILIKE $${placeholderIndex} OR answer ILIKE $${placeholderIndex})`);
      values.push(`%${input.search}%`);
      placeholderIndex += 1;
    }

    if (input.difficulty) {
      filters.push(`difficulty = $${placeholderIndex}`);
      values.push(input.difficulty);
      placeholderIndex += 1;
    }

    const query = `
      SELECT ${flashcardFields.join(",")}
      FROM flashcards
      WHERE ${filters.join(" AND ")}
      ORDER BY updated_at DESC;
    `;

    return this.executeSql({ query, params: values });
  }

  public async findDueCards(input: { userId: string; limit: number }) {
    const query = `
      SELECT
        f.id,
        f.question,
        f.answer,
        f.next_review_date,
        f.tags,
        f.source,
        d.name AS deck_name,
        ROW_NUMBER() OVER (PARTITION BY f.deck_id ORDER BY f.next_review_date) AS position,
        COUNT(*) OVER () AS total_due
      FROM flashcards f
      INNER JOIN decks d ON d.id = f.deck_id
      WHERE f.user_id = $1
        AND f.next_review_date IS NOT NULL
        AND f.next_review_date <= NOW()
      ORDER BY f.next_review_date ASC
      LIMIT $2;
    `;

    return this.executeSql({ query, params: [input.userId, input.limit] });
  }

  public async countDueCards(input: { userId: string }) {
    const query = `
      SELECT COUNT(*)::int AS total
      FROM flashcards
      WHERE user_id = $1
        AND next_review_date IS NOT NULL
        AND next_review_date <= NOW();
    `;

    const result = await this.executeSql({ query, params: [input.userId] });
    return result.length > 0 ? Number(result[0].total) : 0;
  }

  public async countByStatus(input: { userId: string }) {
    const query = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'mastered')::int AS mastered
      FROM flashcards
      WHERE user_id = $1;
    `;

    const result = await this.executeSql({ query, params: [input.userId] });
    return result.length > 0
      ? { total: Number(result[0].total), mastered: Number(result[0].mastered) }
      : { total: 0, mastered: 0 };
  }

  public async countReviewedSince(input: { userId: string; since: Date }) {
    const query = `
      SELECT COUNT(*)::int AS reviewed
      FROM flashcards
      WHERE user_id = $1 AND last_review_date >= $2;
    `;

    const result = await this.executeSql({ query, params: [input.userId, input.since] });
    return result.length > 0 ? Number(result[0].reviewed) : 0;
  }

  public async getReviewHistory(input: { userId: string; days: number }) {
    const query = `
      WITH dates AS (
        SELECT generate_series(0, $2) AS day_offset
      )
      SELECT
        (CURRENT_DATE - day_offset) AS day,
        COALESCE(reviewed.count, 0) AS reviewed,
        COALESCE(created.count, 0) AS created
      FROM dates
      LEFT JOIN (
        SELECT DATE(last_review_date) AS day, COUNT(*) AS count
        FROM flashcards
        WHERE user_id = $1 AND last_review_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
        GROUP BY day
      ) reviewed ON reviewed.day = CURRENT_DATE - day_offset
      LEFT JOIN (
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM flashcards
        WHERE user_id = $1 AND created_at >= CURRENT_DATE - ($2 || ' days')::INTERVAL
        GROUP BY day
      ) created ON created.day = CURRENT_DATE - day_offset
      ORDER BY day;
    `;

    return this.executeSql({ query, params: [input.userId, input.days] });
  }
}

export const flashcardModel = new FlashcardModel();
