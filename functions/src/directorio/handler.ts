import type {Request, Response} from "express";
import {HttpError, toErrorResult} from "../shared/http.js";
import type {MedicosReader} from "./repository.js";
import {parseDirectoryQuery} from "./validation.js";

export function createDirectoryHandler(
  reader: MedicosReader,
): (request: Request, response: Response) => Promise<void> {
  return async (request, response) => {
    response.setHeader("Content-Type", "application/json");

    try {
      if (request.method !== "GET") {
        throw new HttpError(405, "METHOD_NOT_ALLOWED", "Método no permitido");
      }

      const query = parseDirectoryQuery(request.query);
      try {
        const page = await reader.list(query);
        response.status(200).json(page);
      } catch {
        response.status(500).json({
          error: {code: "INTERNAL", message: "Error interno"},
        });
      }
    } catch (error) {
      const result = toErrorResult(error);
      response.status(result.status).json(result.body);
    }
  };
}
