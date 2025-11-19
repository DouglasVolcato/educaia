import { Application, Request, Response } from "express";
import { BaseApiController } from "./base-api.controller.ts";
import { userModel } from "../../../db/models/user.model.ts";
import { InputField } from "../../../db/repository.ts";

export class AccountController extends BaseApiController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.put("/account", this.handleUpdateAccount);
    this.router.put("/account/preferences", this.handleUpdatePreferences);
  }

  private handleUpdateAccount = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const updates: InputField[] = [];
    const name = req.body?.name?.toString()?.trim();
    const email = req.body?.email?.toString()?.trim()?.toLowerCase();
    const timezone = req.body?.timezone?.toString()?.trim();

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
      if (!name) {
        this.sendToastResponse(res, {
          status: 400,
          message: "Informe um nome válido.",
          variant: "danger",
        });
        return;
      }
      updates.push({ key: "name", value: name });
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "email")) {
      if (!email) {
        this.sendToastResponse(res, {
          status: 400,
          message: "Informe um e-mail válido.",
          variant: "danger",
        });
        return;
      }
      updates.push({ key: "email", value: email });
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "timezone") && timezone) {
      updates.push({ key: "timezone", value: timezone });
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "goal")) {
      const goalValue = Number(req.body.goal);
      if (Number.isNaN(goalValue) || goalValue <= 0) {
        this.sendToastResponse(res, {
          status: 400,
          message: "A meta diária precisa ser um número positivo.",
          variant: "danger",
        });
        return;
      }
      updates.push({ key: "goal_per_day", value: goalValue });
    }

    if (updates.length === 0) {
      this.sendToastResponse(res, {
        status: 200,
        message: "Nenhuma alteração foi aplicada ao seu perfil.",
        variant: "info",
      });
      return;
    }

    try {
      await userModel.update({ id: user.id, fields: updates });
      this.sendToastResponse(res, {
        status: 200,
        message: "Dados da conta atualizados com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update account", error, res);
    }
  };

  private handleUpdatePreferences = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    try {
      await userModel.update({
        id: user.id,
        fields: [
          { key: "reminder_email", value: this.parseCheckbox(req.body?.reminderEmail) },
          { key: "reminder_push", value: this.parseCheckbox(req.body?.reminderPush) },
          { key: "weekly_summary", value: this.parseCheckbox(req.body?.weeklySummary) },
          { key: "ai_suggestions", value: this.parseCheckbox(req.body?.aiSuggestions) },
        ],
      });

      this.sendToastResponse(res, {
        status: 200,
        message: "Preferências atualizadas com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update preferences", error, res);
    }
  };
}
