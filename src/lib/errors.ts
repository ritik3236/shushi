// Typed application errors. Thrown by services/actions, mapped to friendly
// messages at the boundary (route handlers / server actions).

export class UnauthorizedError extends Error {
  constructor(message = "You need to sign in to do that.") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

/** Reduce an unknown thrown value to a user-facing message. */
export function toErrorMessage(error: unknown): string {
  if (
    error instanceof UnauthorizedError ||
    error instanceof NotFoundError ||
    error instanceof ValidationError
  ) {
    return error.message
  }
  if (error instanceof Error && process.env.NODE_ENV === "development") {
    return error.message
  }
  return "Something went wrong. Please try again."
}
