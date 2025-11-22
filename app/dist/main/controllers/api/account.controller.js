import { userModel } from "../../../db/models/user.model.js";
import { BaseController } from "../base.controller.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
const accountUpdateSchema = z.object({
    name: z.string().trim().min(1, "Informe um nome válido.").optional(),
    email: z.string().trim().email("Informe um e-mail válido.").optional(),
    password: z.string().trim().min(6, "A senha deve ter ao menos 6 caracteres.").optional(),
});
export class AccountController extends BaseController {
    constructor(app) {
        super(app);
        this.handleUpdateAccount = async (req, res) => {
            const user = this.ensureAuthenticatedUser(req, res);
            if (!user) {
                return;
            }
            const parsed = accountUpdateSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
                this.sendToastResponse(res, { status: 400, message, variant: "danger" });
                return;
            }
            const updates = [];
            const hasName = Object.prototype.hasOwnProperty.call(parsed.data, "name");
            const hasEmail = Object.prototype.hasOwnProperty.call(parsed.data, "email");
            const hasPassword = Object.prototype.hasOwnProperty.call(parsed.data, "password");
            if (hasName && parsed.data.name) {
                updates.push({ key: "name", value: parsed.data.name });
            }
            if (hasEmail && parsed.data.email) {
                updates.push({ key: "email", value: parsed.data.email.toLowerCase() });
            }
            if (hasPassword && parsed.data.password) {
                updates.push({ key: "password", value: await bcrypt.hash(parsed.data.password, 10) });
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
