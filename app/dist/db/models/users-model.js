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
            insertFields: ["id", "name", "email", "password"],
            updateFields: ["name", "email", "password"],
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
        const fields = [
            { key: "id", value: input.id },
            { key: "name", value: input.name },
            { key: "email", value: input.email },
            { key: "password", value: input.password },
        ];
        await this.insert({ fields });
    }
}
export const usersModel = new UsersModel();
