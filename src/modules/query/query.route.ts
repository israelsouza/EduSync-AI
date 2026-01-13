import { Router } from "express";
import { postQuery } from "./query.controller.js";

const queryRouter = Router();

queryRouter.post("/", postQuery);

export default queryRouter;
