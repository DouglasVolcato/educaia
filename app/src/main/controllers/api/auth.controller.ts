import { Application, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { BaseController } from "../base.controller.ts";
import { usersModel } from "../../../db/models/users-model.ts";
import { UuidGeneratorAdapter } from "../../../adapters/uuid-generator-adapter.ts";

export class AuthController extends BaseController {
  constructor(app: Application) {
    super(app, { requiresAuth: false });
  }

  protected registerRoutes(): void {
    this.router.post("/auth/register", this.handleRegister);
    this.router.post("/auth/login", this.handleLogin);
  }

  private handleRegister = async (req: Request, res: Response) => {
    const schema = z
      .object({
        firstName: z.string().trim().min(1, "Informe seu primeiro nome."),
        lastName: z.string().trim().min(1, "Informe seu sobrenome."),
        email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
        password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
        confirmPassword: z.string().min(6, "Confirme sua senha para continuar."),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: "As senhas informadas não conferem.",
        path: ["confirmPassword"],
      });

    const validated = this.validateSchema(schema, req.body, res);
    if (!validated) {
      return;
    }

    try {
      const existingUser = await usersModel.findByEmail(validated.email);
      if (existingUser) {
        this.sendToastResponse(res, {
          status: 409,
          message: "Já existe uma conta utilizando este e-mail.",
          variant: "danger",
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(validated.password, 10);
      const id = UuidGeneratorAdapter.generate();

      await usersModel.createUser({
        id,
        name: `${validated.firstName} ${validated.lastName}`.trim(),
        email: validated.email,
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
    const schema = z.object({
      email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
      password: z.string().min(1, "Informe sua senha para continuar."),
    });

    const validated = this.validateSchema(schema, req.body, res);
    if (!validated) {
      return;
    }

    try {
      const user = await usersModel.findByEmail(validated.email);
      if (!user) {
        this.sendToastResponse(res, {
          status: 401,
          message: "Credenciais inválidas.",
          variant: "danger",
        });
        return;
      }

      const isValidPassword = await bcrypt.compare(validated.password, user.password);
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
