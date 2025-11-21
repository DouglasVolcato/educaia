import { Repository } from "../repository.ts";

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
      ],
      updateFields: [
        "name",
        "slug",
        "connected",
      ],
    });
  }
}

export const integrationModel = new IntegrationModel();
