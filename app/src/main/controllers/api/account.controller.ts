import { Application, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { userModel } from "../../../db/models/user.model.ts";
import { BaseController } from "../base.controller.ts";
import { InputField } from "../../../db/repository.ts";

export class AccountController extends BaseController {
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

    const schema = z.object({
      name: z
        .string({ required_error: "Informe um nome válido." })
        .trim()
        .min(1, "Informe um nome válido.")
        .optional(),
      email: z
        .string({ required_error: "Informe um e-mail válido." })
        .trim()
        .toLowerCase()
        .email("Informe um e-mail válido.")
        .optional(),
      password: z
        .string()
        .trim()
        .min(6, "A senha deve ter ao menos 6 caracteres.")
        .optional(),
    });

    const validated = this.validateSchema(schema, req.body, res);
    if (!validated) {
      return;
    }

    const updates: InputField[] = [];

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
      if (!validated.name) {
        this.sendToastResponse(res, {
          status: 400,
          message: "Informe um nome válido.",
          variant: "danger",
        });
        return;
      }
      updates.push({ key: "name", value: validated.name });
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "email")) {
      if (!validated.email) {
        this.sendToastResponse(res, {
          status: 400,
          message: "Informe um e-mail válido.",
          variant: "danger",
        });
        return;
      }
      updates.push({ key: "email", value: validated.email });
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "password") && validated.password) {
      updates.push({ key: "password", value: await bcrypt.hash(validated.password, 10) });
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

    const schema = z.object({
      reminderEmail: z.coerce.boolean().default(false),
      reminderPush: z.coerce.boolean().default(false),
      weeklySummary: z.coerce.boolean().default(false),
      aiSuggestions: z.coerce.boolean().default(false),
    });

    const validated = this.validateSchema(schema, req.body, res);
    if (!validated) {
      return;
    }

    try {
      await userModel.update({
        id: user.id,
        fields: [
          { key: "reminder_email", value: validated.reminderEmail },
          { key: "reminder_push", value: validated.reminderPush },
          { key: "weekly_summary", value: validated.weeklySummary },
          { key: "ai_suggestions", value: validated.aiSuggestions },
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
