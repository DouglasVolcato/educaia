import { Repository } from "../repository.js";
class UsersModel extends Repository {
    constructor() {
        super({
            tableName: "users",
            idField: "id",
            publicFields: [
                "id",
                "name",
                "email",
                "password",
                "created_at",
                "updated_at",
            ],
            insertFields: ["id", "name", "email", "password", "created_at", "updated_at"],
            updateFields: ["name", "email", "password", "updated_at"],
        });
    }
    async findByEmail(email) {
        return (await this.findOne({
            params: [{ key: "email", value: email }],
        }));
    }
    async findById(id) {
        return (await this.findOne({
            params: [{ key: "id", value: id }],
        }));
    }
    async createUser(input) {
        const now = new Date();
        const fields = [
            { key: "id", value: input.id },
            { key: "name", value: input.name },
            { key: "email", value: input.email },
            { key: "password", value: input.password },
            { key: "created_at", value: now },
            { key: "updated_at", value: now },
        ];
        await this.insert({ fields });
    }
}
export const usersModel = new UsersModel();
