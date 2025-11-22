import { Application, Request, Response } from "express";
import axios from "axios";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UuidGeneratorAdapter } from "../../adapters/uuid-generator-adapter.ts";
import { usersModel } from "../../db/models/users-model.ts";
import { BaseController } from "../base-controller.ts";
import { authRateLimiter } from "../rate-limiters.ts";

export class AuthController extends BaseController {
  constructor(app: Application) {
    super(app, { requiresAuth: false, rateLimiter: authRateLimiter });
  }

  protected registerRoutes(): void {
    this.router.post("/auth/register", this.handleRegister);
    this.router.post("/auth/login", this.handleLogin);
    this.router.post("/auth/google", this.handleGoogleLogin);
  }

  private async validateGoogleCredential(credential: string, clientId: string) {
    type GoogleTokenInfo = {
      aud: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      given_name?: string;
      family_name?: string;
    };

    const response = await axios.get<GoogleTokenInfo>(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    );

    const payload = response.data;

    if (!payload || payload.aud !== clientId || !payload.email) {
      return null;
    }

    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    if (!emailVerified) {
      return null;
    }

    const nameFromPayload =
      payload.name ?? `${payload.given_name ?? ""} ${payload.family_name ?? ""}`.trim();

    return {
      email: payload.email.trim().toLowerCase(),
      name: nameFromPayload && nameFromPayload.length > 0 ? nameFromPayload : payload.email,
    };
  }

  private handleRegister = async (req: Request, res: Response) => {
    const registerSchema = z
      .object({
        firstName: z.string().trim().min(1, "Preencha todos os campos obrigatórios para criar sua conta."),
        lastName: z.string().trim().min(1, "Preencha todos os campos obrigatórios para criar sua conta."),
        email: z.string().trim().min(1, "Preencha todos os campos obrigatórios para criar sua conta."),
        password: z.string().min(1, "Preencha todos os campos obrigatórios para criar sua conta."),
        confirmPassword: z.string().min(1, "Preencha todos os campos obrigatórios para criar sua conta."),
      })
      .superRefine((data, ctx) => {
        if (data.password !== data.confirmPassword) {
          ctx.addIssue({
            code: "custom",
            path: ["confirmPassword"],
            message: "As senhas informadas não conferem.",
          });
        }
      });

    const parsed = registerSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
      this.sendToastResponse(res, { status: 400, message, variant: "danger" });
      return;
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const firstName = parsed.data.firstName.trim();
    const lastName = parsed.data.lastName.trim();
    const password = parsed.data.password;

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
    const loginSchema = z.object({
      email: z.string().trim().min(1, "Informe seu e-mail e senha para continuar."),
      password: z.string().min(1, "Informe seu e-mail e senha para continuar."),
    });

    const parsed = loginSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Dados inválidos.";
      this.sendToastResponse(res, { status: 400, message, variant: "danger" });
      return;
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

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

  private handleGoogleLogin = async (req: Request, res: Response) => {
    const googleLoginSchema = z.object({
      credential: z.string().trim().min(1, "Token do Google inválido ou ausente."),
    });

    const parsed = googleLoginSchema.safeParse(req.body ?? {});
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Token do Google inválido ou ausente.";
      this.sendToastResponse(res, { status: 400, message, variant: "danger" });
      return;
    }

    if (!clientId) {
      this.sendToastResponse(res, {
        status: 503,
        message: "Login com Google não está configurado.",
        variant: "danger",
      });
      return;
    }

    try {
      const profile = await this.validateGoogleCredential(parsed.data.credential, clientId);

      if (!profile) {
        this.sendToastResponse(res, {
          status: 401,
          message: "Não foi possível validar seu login com Google.",
          variant: "danger",
        });
        return;
      }

      const existingUser = await usersModel.findByEmail(profile.email);

      let userId = existingUser?.id;

      if (!existingUser) {
        const id = UuidGeneratorAdapter.generate();
        const randomPassword = await bcrypt.hash(UuidGeneratorAdapter.generate(), 10);
        await usersModel.createUser({
          id,
          name: profile.name,
          email: profile.email,
          password: randomPassword,
        });
        userId = id;
      }

      if (!userId) {
        this.sendToastResponse(res, {
          status: 500,
          message: "Não foi possível concluir seu login com Google.",
          variant: "danger",
        });
        return;
      }

      const token = this.getJwtAdapter().generateToken({ userId });
      this.setSessionCookie(res, token);
      res.setHeader("HX-Redirect", "/app/decks");

      this.sendToastResponse(res, {
        status: 200,
        message: "Login com Google realizado! Redirecionando...",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to authenticate with Google", error);
      this.sendToastResponse(res, {
        status: 500,
        message: "Não foi possível acessar sua conta via Google. Tente novamente em instantes.",
        variant: "danger",
      });
    }
  };
}
