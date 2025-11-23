import { integrationModel } from "../../db/models/integration.model.ts";
import { Application, Request, Response } from "express";
import { BaseController } from "../base-controller.ts";
import { z } from "zod";

export class IntegrationController extends BaseController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.put("/integrations/:integrationId", this.handleUpdateIntegration);
  }

  private handleUpdateIntegration = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const { integrationId } = req.params;

    try {
      const updateIntegrationSchema = z.object({
        connected: z.union([z.boolean(), z.string()]).optional(),
        name: z.string().trim().optional(),
      });

      const parsed = updateIntegrationSchema.safeParse(req.body ?? {});

      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
        this.sendToastResponse(res, { status: 400, message, variant: "danger" });
        return;
      }

      const integration = await integrationModel.findOne({
        params: [
          { key: "id", value: integrationId },
          { key: "user_id", value: user.id },
        ],
      });

      if (!integration) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Integração não encontrada.",
          variant: "danger",
        });
        return;
      }

      const connected = this.parseCheckbox(parsed.data.connected);
      const integrationName = parsed.data.name?.length ? parsed.data.name : integration.name;

      await integrationModel.update({
        id: integrationId,
        fields: [
          { key: "connected", value: connected },
          { key: "name", value: integrationName },
        ],
      });

      this.sendToastResponse(res, {
        status: 200,
        message: "Integração atualizada com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update integration", error, res);
    }
  };
}
