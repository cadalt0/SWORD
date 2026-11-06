import { SwordError } from "sword-sdk";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/// An error the API answers with: an HTTP status, a stable code for programs, and a message for people.
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type ErrorBody = { error: { code: string; message: string; contractError?: string; [key: string]: unknown } };

/// SDK error codes that mean "already done" or "in the way", so they answer 409 instead of 400.
const CONFLICT = /EXISTS|TAKEN|ALREADY|NOT_OPEN|CANCELLED/;
/// SDK error codes that mean the merchant's permission does not cover the action.
const PERMISSION = /PERMISSION|MANDATE|GRANT/;

/// Turns any thrown value into a status and a JSON body. Unexpected errors are logged and kept vague.
export function toErrorResponse(error: unknown): { status: ContentfulStatusCode; body: ErrorBody } {
  if (error instanceof ApiError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message, ...error.extra } } };
  }
  if (error instanceof SwordError) {
    const contractError = error.contractError;
    const code = error.code;
    const status = PERMISSION.test(code) || PERMISSION.test(contractError ?? "") ? 403 : CONFLICT.test(code) || CONFLICT.test(contractError ?? "") ? 409 : 400;
    return { status, body: { error: { code, message: error.message, ...(contractError ? { contractError } : {}) } } };
  }
  console.error(error);
  return { status: 500, body: { error: { code: "SERVER_ERROR", message: "Something went wrong on our side. Try again." } } };
}
