import "express-serve-static-core";
import type { UserRecord } from "../../db/models/users-model.ts";

declare module "express-serve-static-core" {
  interface Request {
    user?: UserRecord | null;
  }
}
