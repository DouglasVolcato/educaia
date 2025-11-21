import { Repository } from "../repository.js";
export class DeckModel extends Repository {
    constructor() {
        super({
            tableName: "decks",
            idField: "id",
            publicFields: [
                "id",
                "name",
                "description",
                "subject",
                "tags",
                "user_id",
                "created_at",
                "updated_at",
            ],
            insertFields: [
                "id",
                "name",
                "description",
                "subject",
                "tags",
                "user_id",
            ],
            updateFields: [
                "name",
                "description",
                "subject",
                "tags",
            ],
        });
    }
    async findDecksWithStats(input) {
        const query = `
      SELECT
        d.id,
        d.name,
        d.description,
        d.subject,
        d.tags,
        d.updated_at,
        COUNT(f.*) AS total_cards,
        COUNT(f.*) FILTER (WHERE f.next_review_date IS NOT NULL AND f.next_review_date <= NOW()) AS due_cards,
        COUNT(f.*) FILTER (WHERE f.status = 'new') AS new_cards,
        CASE WHEN COUNT(f.*) = 0 THEN 0
          ELSE ROUND(
            (COUNT(f.*) FILTER (WHERE f.status = 'mastered')::decimal / NULLIF(COUNT(f.*), 0)) * 100
          )
        END AS progress
      FROM decks d
      LEFT JOIN flashcards f ON f.deck_id = d.id
      WHERE d.user_id = $1
      GROUP BY d.id
      ORDER BY d.updated_at DESC;
    `;
        return this.executeSql({ query, params: [input.userId] });
    }
    async findDeckWithStats(input) {
        const decks = await this.executeSql({
            query: `
        SELECT
          d.id,
          d.name,
          d.description,
          d.subject,
          d.tags,
          d.updated_at,
          COUNT(f.*) AS total_cards,
          COUNT(f.*) FILTER (WHERE f.next_review_date IS NOT NULL AND f.next_review_date <= NOW()) AS due_cards,
          COUNT(f.*) FILTER (WHERE f.status = 'new') AS new_cards,
          CASE WHEN COUNT(f.*) = 0 THEN 0
            ELSE ROUND(
              (COUNT(f.*) FILTER (WHERE f.status = 'mastered')::decimal / NULLIF(COUNT(f.*), 0)) * 100
            )
          END AS progress
        FROM decks d
        LEFT JOIN flashcards f ON f.deck_id = d.id
        WHERE d.user_id = $1 AND d.id = $2
        GROUP BY d.id
        LIMIT 1;
      `,
            params: [input.userId, input.deckId],
        });
        return decks.length > 0 ? decks[0] : null;
    }
}
export const deckModel = new DeckModel();
