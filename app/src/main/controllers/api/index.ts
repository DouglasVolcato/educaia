import { Application } from "express";
import { AuthController } from "./auth.controller.ts";
import { DecksController } from "./decks.controller.ts";
import { AccountController } from "./account.controller.ts";
import { IntegrationController } from "./integration.controller.ts";
import { ReviewController } from "./review.controller.ts";

export const registerApiControllers = (app: Application) => {
  new AuthController(app);
  new DecksController(app);
  new AccountController(app);
  new IntegrationController(app);
  new ReviewController(app);
};
