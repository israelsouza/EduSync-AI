import { Router } from "express";
import { testGoogleLLMController } from "./testProvider.controller";

const router = Router();

router.post("/google-llm", testGoogleLLMController);

export default router;
