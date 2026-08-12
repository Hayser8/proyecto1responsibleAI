import type {Request, Response} from "express";
import {HttpError, toErrorResult} from "../shared/http.js";
import type {CollectionSummary} from "./service.js";
import {parseRecolectarInput, type RecolectarInput} from "./validation.js";

interface RecolectarHandlerDependencies {
  collect(input: RecolectarInput, apiKey: string): Promise<CollectionSummary>;
  getApiKey(): string;
}

export function createRecolectarHandler(
  deps: RecolectarHandlerDependencies,
): (request: Request, response: Response) => Promise<void> {
  return async (request, response) => {
    try {
      if (request.method !== "POST") {
        throw new HttpError(405, "METHOD_NOT_ALLOWED", "Método no permitido");
      }
      if (!request.is("application/json")) {
        throw new HttpError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Content-Type debe ser application/json",
        );
      }

      const input = parseRecolectarInput(request.body);
      const summary = await deps.collect(input, deps.getApiKey());
      response.status(200).json(summary);
    } catch (error) {
      const result = toErrorResult(error);
      response.status(result.status).json(result.body);
    }
  };
}
