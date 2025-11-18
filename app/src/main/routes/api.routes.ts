import { SESSION_COOKIE_NAME } from "../../controllers/middlewares/authMiddleware.ts";
import { TokenHandlerAdapter } from "src/adapters/token-handler-adapter";
import { usersModel } from "../../db/models/users-model.ts";
import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";

const apiRouter = Router();
let jwtAdapter: TokenHandlerAdapter | null = null;

const COOKIE_MAX_AGE = 60 * 60 * 1000; // 1 hour

const getJwtAdapter = () => {
  if (!jwtAdapter) {
    jwtAdapter = new TokenHandlerAdapter();
  }
  return jwtAdapter;
};

const createToastMarkup = (message: string, variant: "success" | "danger" | "info" = "info") => `
  <div class="toast show align-items-center text-bg-${variant} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  </div>
`;

const sendToastResponse = (
  res: Response,
  options: { status?: number; message: string; variant?: "success" | "danger" | "info" },
) => {
  res
    .status(options.status ?? 200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(createToastMarkup(options.message, options.variant));
};

const setSessionCookie = (res: Response, token: string) => {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
};

apiRouter.post("/auth/register", async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body ?? {};

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    sendToastResponse(res, {
      status: 400,
      message: "Preencha todos os campos obrigatórios para criar sua conta.",
      variant: "danger",
    });
    return;
  }

  if (password !== confirmPassword) {
    sendToastResponse(res, {
      status: 400,
      message: "As senhas informadas não conferem.",
      variant: "danger",
    });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const existingUser = await usersModel.findByEmail(normalizedEmail);
    if (existingUser) {
      sendToastResponse(res, {
        status: 409,
        message: "Já existe uma conta utilizando este e-mail.",
        variant: "danger",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const id = uuid();

    await usersModel.createUser({
      id,
      name: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = getJwtAdapter().generateToken({ userId: id });
    setSessionCookie(res, token);
    res.setHeader("HX-Redirect", "/app/decks");

    sendToastResponse(res, {
      status: 201,
      message: "Conta criada com sucesso! Redirecionando...",
      variant: "success",
    });
  } catch (error) {
    console.error("Failed to register user", error);
    sendToastResponse(res, {
      status: 500,
      message: "Não foi possível criar sua conta. Tente novamente em instantes.",
      variant: "danger",
    });
  }
});

apiRouter.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    sendToastResponse(res, {
      status: 400,
      message: "Informe seu e-mail e senha para continuar.",
      variant: "danger",
    });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const user = await usersModel.findByEmail(normalizedEmail);
    if (!user) {
      sendToastResponse(res, {
        status: 401,
        message: "Credenciais inválidas.",
        variant: "danger",
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(String(password), user.password);
    if (!isValidPassword) {
      sendToastResponse(res, {
        status: 401,
        message: "Credenciais inválidas.",
        variant: "danger",
      });
      return;
    }

    const token = getJwtAdapter().generateToken({ userId: user.id });
    setSessionCookie(res, token);
    res.setHeader("HX-Redirect", "/app/decks");

    sendToastResponse(res, {
      status: 200,
      message: "Login realizado com sucesso! Redirecionando...",
      variant: "success",
    });
  } catch (error) {
    console.error("Failed to authenticate user", error);
    sendToastResponse(res, {
      status: 500,
      message: "Não foi possível acessar sua conta. Tente novamente em instantes.",
      variant: "danger",
    });
  }
});

export { apiRouter };
