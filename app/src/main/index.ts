import { appRouter } from "./routes/app.routes.ts";
import { fileURLToPath } from "url";
import 'module-alias/register.js';
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { DbConnection } from "@db/db-connection";


dotenv.config({
  path: "./.env"
});

const port = process.env.PORT;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

app.locals.brand = "EducaIA";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(rootDir, "src", "presentation", "views"));
app.use("/static", express.static(path.join(rootDir, "src", "presentation", "public")));
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

app.use("/app", appRouter);

const bootstrap = async () => {
  try {
    await DbConnection.connect();
    app.listen(port, () => {
      console.log(`Server running on ${process.env.API_URL || "http://localhost:3000"}`);
      console.log(`Documentation on ${process.env.API_URL}/docs`);
      console.log(`Client on ${process.env.API_URL}/client`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

bootstrap();
