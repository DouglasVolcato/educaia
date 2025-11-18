import { TokenHandlerAdapter } from "src/adapters/token-handler-adapter";
import { usersModel } from "../../db/models/users-model.ts";
import { NextFunction, Request, Response } from "express";

export const SESSION_COOKIE_NAME = "session_token";
const PUBLIC_PATHS = new Set(["/login", "/register", "/"]);

let jwtAdapter: TokenHandlerAdapter | null = null;

const getJwtAdapter = () => {
  if (!jwtAdapter) {
    jwtAdapter = new TokenHandlerAdapter();
  }
  return jwtAdapter;
};

const redirectToLogin = (res: Response) => {
  res.status(403).redirect("/app/login");
};

const extractTokenFromCookies = (req: Request): string | null => {
  const { cookie } = req.headers;
  if (!cookie) {
    return null;
  }

  const cookies = cookie.split(";");
  for (const entry of cookies) {
    const [rawName, ...rest] = entry.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      return rest.join("=");
    }
  }
  return null;
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }

  try {
    const token = extractTokenFromCookies(req);
    if (!token) {
      redirectToLogin(res);
      return;
    }

    const payload = getJwtAdapter().verifyToken(token);
    if (!payload?.userId) {
      redirectToLogin(res);
      return;
    }

    const user = await usersModel.findById(payload.userId);
    if (!user) {
      redirectToLogin(res);
      return;
    }

    req.user = user;
    res.locals.user = user;
    next();
  } catch (error) {
    console.error("Failed to authenticate request", error);
    redirectToLogin(res);
  }
};
