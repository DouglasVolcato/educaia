console.log("Starting application 0");

import { DbConnection } from "../db/db-connection.ts";
import { fileURLToPath } from "url";
import "module-alias/register.js";
import { inspect } from "util";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { AuthController } from "./controllers/api/auth.controller.ts";
import { DecksController } from "./controllers/api/decks.controller.ts";
import { AccountController } from "./controllers/api/account.controller.ts";
import { IntegrationController } from "./controllers/api/integration.controller.ts";
import { ReviewController } from "./controllers/api/review.controller.ts";
import { AppController } from "./controllers/app/app.controller.ts";

console.log("Starting application 1");

const normalizeError = (error: unknown) =>
  error instanceof Error ? error : new Error(inspect(error, { depth: null }));

process.on("uncaughtException", (error) => {
  console.error("uncaughtException", normalizeError(error));
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", normalizeError(reason));
});

dotenv.config({
  path: "./.env",
});

console.log("Starting application 2");

const port = process.env.PORT;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

app.locals.brand = "EducaIA";
app.locals.staticVersion = "1";

const ONE_MONTH_IN_MS = 1000 * 60 * 60 * 24 * 30;

console.log("Starting application 3");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(rootDir, "src", "presentation", "views"));
app.use(
  "/static",
  express.static(path.join(rootDir, "src", "presentation", "public"), {
    maxAge: ONE_MONTH_IN_MS,
    immutable: true,
  })
);
app.disable("x-powered-by");

app.get("/", (_, res) => {
  res.render("landing/index");
});
app.get("/privacy", (_, res) => {
  res.render("landing/privacy");
});
app.get("/terms", (_, res) => {
  res.render("landing/terms");
});

console.log("Starting application 4");

new AuthController(app);
new DecksController(app);
new AccountController(app);
new IntegrationController(app);
new ReviewController(app);
new AppController(app)

console.log("Starting application 5");

const bootstrap = async () => {
  try {
    console.log("Starting application 6");
    await DbConnection.connect();
    console.log("Starting application 7");
    app.listen(port, () => {
      console.log(`Server running on ${process.env.API_URL || "http://localhost:3000"}`);
    });
  } catch (error) {
    console.error("Failed to start server", normalizeError(error));
    process.exit(1);
  }
};

bootstrap();
