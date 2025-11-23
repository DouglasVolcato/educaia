import { IntegrationController } from "../controllers/api/integration-controller.ts";
import { AccountController } from "../controllers/api/account-controller.ts";
import { httpRequestsTotal, metricsRegistry } from "../metrics/metrics.ts";
import { ReviewController } from "../controllers/api/review-controller.ts";
import { DecksController } from "../controllers/api/decks-controller.ts";
import { deckGenerationQueue } from "../queue/deck-generation-queue.ts";
import { AuthController } from "../controllers/api/auth-controller.ts";
import { AppController } from "../controllers/app/app-controller.ts";
import { DbConnection } from "../db/db-connection.ts";
import { fileURLToPath } from "url";
import "module-alias/register.js";
import { inspect } from "util";
import express from "express";
import helmet from "helmet";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

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

const port = process.env.PORT;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

app.locals.brand = "EducaIA";
app.locals.staticVersion = "1";

const ONE_MONTH_IN_MS = 1000 * 60 * 60 * 24 * 30;

app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(rootDir, "src", "presentation", "views"));
app.use(
  "/",
  express.static(path.join(rootDir, "src", "presentation", "public"), {
    maxAge: ONE_MONTH_IN_MS,
    immutable: true,
  })
);
app.disable("x-powered-by");

app.get("/", (_, res) => {
  httpRequestsTotal.inc({
    method: "GET",
    route: "/",
    status_code: String(res.statusCode),
  });
  res.render("landing/index");
});

app.get("/privacy", (_, res) => {
  httpRequestsTotal.inc({
    method: "GET",
    route: "/privacy",
    status_code: String(res.statusCode),
  });
  res.render("landing/privacy");
});

app.get("/terms", (_, res) => {
  httpRequestsTotal.inc({
    method: "GET",
    route: "/terms",
    status_code: String(res.statusCode),
  });
  res.render("landing/terms");
});

app.get("/metrics", async (_, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});

new AuthController(app).setUp();
new DecksController(app).setUp();
new AccountController(app).setUp();
new IntegrationController(app).setUp();
new ReviewController(app).setUp();
new AppController(app).setUp();

const bootstrap = async () => {
  try {
    await DbConnection.connect();
    await deckGenerationQueue.init();
    app.listen(port, () => {
      console.log(`Server running on ${process.env.API_URL || "http://localhost:3003"}`);
    });
  } catch (error) {
    console.error("Failed to start server", normalizeError(error));
    process.exit(1);
  }
};

bootstrap();
