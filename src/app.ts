import express from "express";
import cors from "cors";
import { errorMiddleware } from "./shared/error.middleware";
import healthRouter from "./modules/health/health.route";
import queryRouter from "./modules/query/query.route";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("Hello, World!");
});

app.use("/health", healthRouter);
app.use("/query", queryRouter);

app.use(errorMiddleware);

export default app;
