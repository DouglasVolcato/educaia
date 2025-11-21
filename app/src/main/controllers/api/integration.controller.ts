import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { integrationModel } from "../../../db/models/integration.model.ts";

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

      await integrationModel.update({
        id: integrationId,
        fields: [
          { key: "connected", value: this.parseCheckbox(req.body?.connected) },
          { key: "name", value: req.body?.name?.toString() ?? integration.name },
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
