import { userModel } from "../../../db/models/user.model.js";
import { BaseController } from "../base.controller.js";
import bcrypt from "bcryptjs";
export class AccountController extends BaseController {
    constructor(app) {
        super(app);
        this.handleUpdateAccount = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const updates = [];
            const name = req.body?.name?.toString()?.trim();
            const email = req.body?.email?.toString()?.trim()?.toLowerCase();
            const password = req.body?.password?.toString()?.trim();
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
            if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "password") && password.length > 0) {
                if (password && password.length < 6) {
                    this.sendToastResponse(res, {
                        status: 400,
                        message: "A senha deve ter ao menos 6 caracteres.",
                        variant: "danger",
                    });
                    return;
                }
                updates.push({ key: "password", value: await bcrypt.hash(String(password), 10) });
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
            }
            catch (error) {
                this.handleUnexpectedError("Failed to update account", error, res);
            }
        };
        this.handleUpdatePreferences = async (req, res) => {
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
            }
            catch (error) {
                this.handleUnexpectedError("Failed to update preferences", error, res);
            }
        };
    }
    registerRoutes() {
        this.router.put("/account", this.handleUpdateAccount);
        this.router.put("/account/preferences", this.handleUpdatePreferences);
    }
}
