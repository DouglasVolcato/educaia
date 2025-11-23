import { Repository } from "../repository.ts";

const processFields = [
  "id",
  "user_id",
  "deck_id",
  "status",
  "created_at",
  "updated_at",
];

const insertFields = processFields.filter((field) => field !== "created_at" && field !== "updated_at");

export type CardGenerationProcessRow = {
  id: string;
  user_id: string;
  deck_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

class CardGenerationProcessModel extends Repository {
  constructor() {
    super({
      tableName: "card_generation_processes",
      idField: "id",
      publicFields: processFields,
      insertFields,
      updateFields: ["status"],
    });
  }

  public async findActiveByDeck(input: { deckId: string; userId: string }) {
    const query = `
      SELECT ${processFields.join(",")}
      FROM card_generation_processes
      WHERE deck_id = $1 AND user_id = $2
      ORDER BY created_at DESC;
    `;

    return this.executeSql({ query, params: [input.deckId, input.userId] });
  }

  public async deleteById(id: string) {
    await this.delete({
      params: [{ key: "id", value: id }],
    });
  }
}

export const cardGenerationProcessModel = new CardGenerationProcessModel();
