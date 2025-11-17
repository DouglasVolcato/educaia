import { Repository } from "@db/repository";

export class IntegrationModel extends Repository {
  constructor() {
    super({
      tableName: "user_integrations",
      idField: "id",
      publicFields: [
        "id",
        "user_id",
        "name",
        "slug",
        "connected",
        "created_at",
        "updated_at",
      ],
      insertFields: [
        "id",
        "user_id",
        "name",
        "slug",
        "connected",
        "created_at",
        "updated_at",
      ],
      updateFields: [
        "name",
        "slug",
        "connected",
        "updated_at",
      ],
    });
  }
}

export const integrationModel = new IntegrationModel();
