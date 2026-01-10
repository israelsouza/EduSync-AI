import { NextFunction, Request, Response } from "express";
import { AppError } from "./AppError";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorMiddleware = (error: Error & { statusCode?: number }, req: Request, res: Response, _: NextFunction) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : "Internal Server Error";

  console.error(`[${req.method}] ${req.url} - Error: ${error.message}`);

  return res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    ...(process.env["NODE_ENV"] !== "production" && { stack: error.stack }),
  });
};
