import express from "express";
import { errorMiddleware } from "./shared/error.middleware";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use(errorMiddleware);

export default app;
