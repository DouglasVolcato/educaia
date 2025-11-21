import { Repository, InputField } from "../repository.ts";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: Date;
  updated_at: Date;
}

class UsersModel extends Repository {
  public constructor() {
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

  public async findByEmail(email: string): Promise<UserRecord | null> {
    return (await this.findOne({
      params: [{ key: "email", value: email }],
    })) as UserRecord | null;
  }

  public async findById(id: string): Promise<UserRecord | null> {
    return (await this.findOne({
      params: [{ key: "id", value: id }],
    })) as UserRecord | null;
  }

  public async createUser(input: {
    id: string;
    name: string;
    email: string;
    password: string;
  }): Promise<void> {
    const fields: InputField[] = [
      { key: "id", value: input.id },
      { key: "name", value: input.name },
      { key: "email", value: input.email },
      { key: "password", value: input.password },
    ];

    await this.insert({ fields });
  }
}

export const usersModel = new UsersModel();
