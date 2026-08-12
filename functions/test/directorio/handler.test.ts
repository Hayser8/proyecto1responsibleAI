import type {Request, Response} from "express";
import {describe, expect, it} from "vitest";
import {createDirectoryHandler} from "../../src/directorio/handler.js";
import type {DirectoryPage, MedicosReader} from "../../src/directorio/repository.js";
import {HttpError} from "../../src/shared/http.js";

const directoryPage: DirectoryPage = {
  data: [{
    nombre: "Dra. Ana López",
    especialidad: "Pediatría",
    direccion: "10 avenida 1-01",
    telefono: "+502 2222-2222",
    sitio_web: "https://example.com",
    zona: "10",
    place_id: "place-1",
    fecha_recoleccion: "2026-08-02T12:00:00.000Z",
    keyword_usado: "pediatra zona 10",
  }],
  pagination: {
    page: 2,
    pageSize: 10,
    returned: 1,
    hasNextPage: false,
  },
  filters: {
    especialidad: "Pediatría",
    zona: "10",
  },
};

interface CapturedResponse {
  status?: number;
  body?: unknown;
  contentType?: string;
}

function makeRequest(method: string, query: Record<string, unknown> = {}): Request {
  return {method, query} as unknown as Request;
}

function makeResponse(): {response: Response; captured: CapturedResponse} {
  const captured: CapturedResponse = {};
  const response = {
    setHeader(name: string, value: string) {
      if (name.toLowerCase() === "content-type") {
        captured.contentType = value;
      }
      return response;
    },
    status(status: number) {
      captured.status = status;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  } as unknown as Response;
  return {response, captured};
}

describe("createDirectoryHandler", () => {
  it("parses a valid GET query, delegates once, and returns the directory page as JSON", async () => {
    const calls: unknown[] = [];
    const reader: MedicosReader = {
      async list(query) {
        calls.push(query);
        return directoryPage;
      },
    };
    const handler = createDirectoryHandler(reader);
    const {response, captured} = makeResponse();

    await handler(makeRequest("GET", {
      page: "2",
      pageSize: "10",
      especialidad: " Pediatría ",
      zona: "10",
    }), response);

    expect(calls).toEqual([{
      page: 2,
      pageSize: 10,
      especialidad: "Pediatría",
      zona: "10",
    }]);
    expect(captured).toEqual({
      status: 200,
      body: directoryPage,
      contentType: "application/json",
    });
  });

  it("returns 405 for POST before reading Firestore", async () => {
    let reads = 0;
    const handler = createDirectoryHandler({
      async list() {
        reads += 1;
        return directoryPage;
      },
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("POST", {page: "2"}), response);

    expect(captured).toEqual({
      status: 405,
      body: {error: {code: "METHOD_NOT_ALLOWED", message: "Método no permitido"}},
      contentType: "application/json",
    });
    expect(reads).toBe(0);
  });

  it("returns 400 for invalid pagination before reading Firestore", async () => {
    let reads = 0;
    const handler = createDirectoryHandler({
      async list() {
        reads += 1;
        return directoryPage;
      },
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("GET", {page: "0"}), response);

    expect(captured).toEqual({
      status: 400,
      body: {error: {code: "INVALID_REQUEST", message: "Solicitud inválida"}},
      contentType: "application/json",
    });
    expect(reads).toBe(0);
  });

  it("returns a safe 500 response when the repository fails", async () => {
    const handler = createDirectoryHandler({
      async list() {
        throw new Error("private Firestore detail");
      },
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("GET"), response);

    expect(captured).toEqual({
      status: 500,
      body: {error: {code: "INTERNAL", message: "Error interno"}},
      contentType: "application/json",
    });
  });

  it("does not expose an HttpError returned by the repository", async () => {
    const handler = createDirectoryHandler({
      async list() {
        throw new HttpError(503, "FIRESTORE_DETAIL", "detalle privado");
      },
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("GET"), response);

    expect(captured).toEqual({
      status: 500,
      body: {error: {code: "INTERNAL", message: "Error interno"}},
      contentType: "application/json",
    });
  });
});
