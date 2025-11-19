import { Application, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { BaseApiController } from "./base-api.controller.ts";
import { usersModel } from "../../../db/models/users-model.ts";
import { UuidGeneratorAdapter } from "../../../adapters/uuid-generator-adapter.ts";

export class AuthController extends BaseApiController {
  constructor(app: Application) {
    super(app, { requiresAuth: false });
  }

  protected registerRoutes(): void {
    this.router.post("/auth/register", this.handleRegister);
    this.router.post("/auth/login", this.handleLogin);
  }

  private handleRegister = async (req: Request, res: Response) => {
    const { firstName, lastName, email, password, confirmPassword } = req.body ?? {};

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      this.sendToastResponse(res, {
        status: 400,
        message: "Preencha todos os campos obrigatórios para criar sua conta.",
        variant: "danger",
      });
      return;
    }

    if (password !== confirmPassword) {
      this.sendToastResponse(res, {
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
        this.sendToastResponse(res, {
          status: 409,
          message: "Já existe uma conta utilizando este e-mail.",
          variant: "danger",
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(String(password), 10);
      const id = UuidGeneratorAdapter.generate();

      await usersModel.createUser({
        id,
        name: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      });

      const token = this.getJwtAdapter().generateToken({ userId: id });
      this.setSessionCookie(res, token);
      res.setHeader("HX-Redirect", "/app/decks");

      this.sendToastResponse(res, {
        status: 201,
        message: "Conta criada com sucesso! Redirecionando...",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to register user", error);
      this.sendToastResponse(res, {
        status: 500,
        message: "Não foi possível criar sua conta. Tente novamente em instantes.",
        variant: "danger",
      });
    }
  };

  private handleLogin = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      this.sendToastResponse(res, {
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
        this.sendToastResponse(res, {
          status: 401,
          message: "Credenciais inválidas.",
          variant: "danger",
        });
        return;
      }

      const isValidPassword = await bcrypt.compare(String(password), user.password);
      if (!isValidPassword) {
        this.sendToastResponse(res, {
          status: 401,
          message: "Credenciais inválidas.",
          variant: "danger",
        });
        return;
      }

      const token = this.getJwtAdapter().generateToken({ userId: user.id });
      this.setSessionCookie(res, token);
      res.setHeader("HX-Redirect", "/app/decks");

      this.sendToastResponse(res, {
        status: 200,
        message: "Login realizado com sucesso! Redirecionando...",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to authenticate user", error);
      this.sendToastResponse(res, {
        status: 500,
        message: "Não foi possível acessar sua conta. Tente novamente em instantes.",
        variant: "danger",
      });
    }
  };
}
