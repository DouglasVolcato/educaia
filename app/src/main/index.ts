import express from "express";
import dotenv from "dotenv"; 
import cors from "cors";

dotenv.config();

const port = process.env.PORT;
const app = express();

app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.disable('x-powered-by');

// test route
app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(port, () => {
  console.log(`Server running on ${process.env.SERVER_DOMAIN}`);
  console.log(`Documentation on ${process.env.SERVER_DOMAIN}/docs`);
  console.log(`Client on ${process.env.SERVER_DOMAIN}/client`);
});