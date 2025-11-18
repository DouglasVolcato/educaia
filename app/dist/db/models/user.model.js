import { Repository } from "../repository.js";
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
