import { Repository } from "@db/repository";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  plan: string | null;
  timezone: string | null;
  avatar_url: string | null;
  streak_in_days: number | null;
  goal_per_day: number | null;
  reminder_email: boolean | null;
  reminder_push: boolean | null;
  weekly_summary: boolean | null;
  ai_suggestions: boolean | null;
};

export class UserModel extends Repository {
  constructor() {
    super({
      tableName: "users",
      idField: "id",
      publicFields: [
        "id",
        "name",
        "email",
        "plan",
        "timezone",
        "avatar_url",
        "streak_in_days",
        "goal_per_day",
        "reminder_email",
        "reminder_push",
        "weekly_summary",
        "ai_suggestions",
        "created_at",
        "updated_at",
      ],
      insertFields: [
        "id",
        "name",
        "email",
        "plan",
        "timezone",
        "avatar_url",
        "streak_in_days",
        "goal_per_day",
        "reminder_email",
        "reminder_push",
        "weekly_summary",
        "ai_suggestions",
        "created_at",
        "updated_at",
      ],
      updateFields: [
        "name",
        "email",
        "plan",
        "timezone",
        "avatar_url",
        "streak_in_days",
        "goal_per_day",
        "reminder_email",
        "reminder_push",
        "weekly_summary",
        "ai_suggestions",
        "updated_at",
      ],
    });
  }
}

export const userModel = new UserModel();
