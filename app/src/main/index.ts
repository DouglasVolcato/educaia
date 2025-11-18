import { authMiddleware } from "../controllers/middlewares/authMiddleware.ts";
import { DbConnection } from "../db/db-connection.ts";
import { appRouter } from "./routes/app.routes.ts";
import { apiRouter } from "./routes/api.routes.ts";
import { fileURLToPath } from "url";
import "module-alias/register.js";
import { inspect } from "util";
import express from "express";
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

app.use("/api", apiRouter);
app.use("/app", authMiddleware, appRouter);

const bootstrap = async () => {
  try {
    await DbConnection.connect();
    app.listen(port, () => {
      console.log(`Server running on ${process.env.API_URL || "http://localhost:3000"}`);
      console.log(`Documentation on ${process.env.API_URL}/docs`);
      console.log(`Client on ${process.env.API_URL}/client`);
    });
  } catch (error) {
    console.error("Failed to start server", normalizeError(error));
    process.exit(1);
  }
};

bootstrap();
