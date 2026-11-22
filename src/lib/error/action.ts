import { failureFromUnknown, type ActionResult } from "./action-result";

/**
 * Converts thrown application errors into the serialisable result shape used
 * by Server Actions. Keep authorization and validation inside `operation`.
 */
export async function runAction<T>(operation: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await operation();
  } catch (error) {
    return failureFromUnknown(error);
  }
}
