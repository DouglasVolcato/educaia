import { Repository } from "../repository.js";
const processFields = [
    "id",
    "user_id",
    "deck_id",
    "status",
    "created_at",
    "updated_at",
];
const insertFields = processFields.filter((field) => field !== "created_at" && field !== "updated_at");
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
    async findActiveByDeck(input) {
        const query = `
      SELECT ${processFields.join(",")}
      FROM card_generation_processes
      WHERE deck_id = $1 AND user_id = $2
      ORDER BY created_at DESC;
    `;
        return this.executeSql({ query, params: [input.deckId, input.userId] });
    }
    async deleteById(id) {
        await this.delete({
            params: [{ key: "id", value: id }],
        });
    }
}
export const cardGenerationProcessModel = new CardGenerationProcessModel();
