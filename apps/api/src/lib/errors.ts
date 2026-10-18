export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);
export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "bad_request", message, details);
export const forbidden = (message = "Forbidden") => new ApiError(403, "forbidden", message);
export const unauthorized = (message = "Missing or invalid API key") =>
  new ApiError(401, "unauthorized", message);
