import { Response } from "express";

function serializeBigInt(data: unknown) {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value
    )
  );
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "OK",
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: serializeBigInt(data),
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown
) {
  return res.status(statusCode).json({
    success: false,
    message,
    details: serializeBigInt(details),
  });
}