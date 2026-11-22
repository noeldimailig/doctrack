import { z } from "zod";
import { toAppError, type ErrorCode } from "./app-error";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, code, message, fieldErrors };
}

export function failureFromZod(error: z.ZodError): ActionResult<never> {
  return failure("VALIDATION_ERROR", "Please check the highlighted fields.", z.flattenError(error).fieldErrors);
}

export function failureFromUnknown(error: unknown): ActionResult<never> {
  const appError = toAppError(error);
  return failure(appError.code, appError.message);
}
