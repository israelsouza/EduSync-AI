import express from "express";
import cors from "cors";
import { errorMiddleware } from "./shared/error.middleware";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("Hello, World!");
});

app.use(errorMiddleware);

export default app;
