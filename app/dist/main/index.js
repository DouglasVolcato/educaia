import 'module-alias/register.js';
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config({
    path: "./.env"
});
const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.disable("x-powered-by");
app.get("/", (_req, res) => {
    res.redirect("/app/login");
});
app.use("/app", app_routes_1.appRouter);
app.listen(port, () => {
    console.log(`Server running on ${process.env.API_URL || "http://localhost:3000"}`);
    console.log(`Documentation on ${process.env.API_URL}/docs`);
    console.log(`Client on ${process.env.API_URL}/client`);
});
