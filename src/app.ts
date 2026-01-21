import express from "express";
import cors from "cors";
import compression from "compression";
import { errorMiddleware } from "./shared/error.middleware";
import healthRouter from "./modules/health/health.route";
import queryRouter from "./modules/query/query.route";
import chatRouter from "./modules/chat/chat.route";
import exportRouter from "./modules/export/export.route";
import syncRouter from "./modules/sync/sync.route";
import voiceRouter from "./modules/voice/voice.route";
import pipelineRouter from "./modules/voice/pipeline.route";
import testRouter from "./modules/tmp/testProviders.route";

const app = express();
app.use(cors());
/* enable gzip compression in all responses */
app.use(compression());
app.use(express.json({ limit: "10mb" })); // Increased limit for audio data

app.get("/", (_, res) => {
  res.send("Hello, World!");
});

app.use("/health", healthRouter);
app.use("/query", queryRouter);
app.use("/chat", chatRouter);
app.use("/api/export", exportRouter);
app.use("/api/sync", syncRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/voice/pipeline", pipelineRouter);
app.use("/tmp", testRouter);

app.use(errorMiddleware);

export default app;
