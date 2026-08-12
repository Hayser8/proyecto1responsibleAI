import type {Request, Response} from "express";
import {describe, expect, it} from "vitest";
import {createRecolectarHandler} from "../../src/recoleccion/handler.js";
import type {CollectionSummary} from "../../src/recoleccion/service.js";
import {HttpError} from "../../src/shared/http.js";

const validBody = {
  keyword: " pediatra   zona 10 Ciudad de Guatemala ",
  zona: "10",
  especialidad: " Pediatría ",
};

const summary: CollectionSummary = {
  keyword: "pediatra zona 10 Ciudad de Guatemala",
  zona: "10",
  especialidad: "Pediatría",
  encontrados: 20,
  creados: 18,
  actualizados: 2,
};

interface CapturedResponse {
  status?: number;
  body?: unknown;
}

function makeRequest(method: string, body: unknown, contentType?: string): Request {
  return {
    method,
    body,
    is(type: string) {
      return type === "application/json" && contentType?.split(";", 1)[0]?.trim() === "application/json"
        ? "application/json"
        : false;
    },
  } as Request;
}

function makeResponse(): {response: Response; captured: CapturedResponse} {
  const captured: CapturedResponse = {};
  const response = {
    status(status: number) {
      captured.status = status;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  } as Response;
  return {response, captured};
}

describe("createRecolectarHandler", () => {
  it("returns 405 for GET before reading the API key or executing the service", async () => {
    let keyReads = 0;
    let collections = 0;
    const handler = createRecolectarHandler({
      async collect() {
        collections += 1;
        return summary;
      },
      getApiKey() {
        keyReads += 1;
        return "test-api-key";
      },
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("GET", validBody, "application/json"), response);

    expect(captured).toEqual({
      status: 405,
      body: {error: {code: "METHOD_NOT_ALLOWED", message: "Método no permitido"}},
    });
    expect(keyReads).toBe(0);
    expect(collections).toBe(0);
  });

  it("returns 415 for a POST without JSON before reading the API key or executing the service", async () => {
    let keyReads = 0;
    let collections = 0;
    const handler = createRecolectarHandler({
      async collect() {
        collections += 1;
        return summary;
      },
      getApiKey() {
        keyReads += 1;
        return "test-api-key";
      },
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("POST", validBody, "text/plain"), response);

    expect(captured).toEqual({
      status: 415,
      body: {error: {code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type debe ser application/json"}},
    });
    expect(keyReads).toBe(0);
    expect(collections).toBe(0);
  });

  it("returns 400 for an invalid body before reading the API key or executing the service", async () => {
    let keyReads = 0;
    let collections = 0;
    const handler = createRecolectarHandler({
      async collect() {
        collections += 1;
        return summary;
      },
      getApiKey() {
        keyReads += 1;
        return "test-api-key";
      },
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("POST", {keyword: "x"}, "application/json"), response);

    expect(captured).toEqual({
      status: 400,
      body: {error: {code: "INVALID_REQUEST", message: "Solicitud inválida"}},
    });
    expect(keyReads).toBe(0);
    expect(collections).toBe(0);
  });

  it("normalizes a valid body and delegates exactly once", async () => {
    const calls: Array<{input: unknown; apiKey: string}> = [];
    const handler = createRecolectarHandler({
      async collect(input, apiKey) {
        calls.push({input, apiKey});
        return summary;
      },
      getApiKey: () => "test-api-key",
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("POST", validBody, "application/json; charset=utf-8"), response);

    expect(captured).toEqual({status: 200, body: summary});
    expect(calls).toEqual([{
      input: {
        keyword: "pediatra zona 10 Ciudad de Guatemala",
        zona: "10",
        especialidad: "Pediatría",
      },
      apiKey: "test-api-key",
    }]);
  });

  it("maps an HttpError thrown by the service through the safe error contract", async () => {
    const handler = createRecolectarHandler({
      async collect() {
        throw new HttpError(429, "PLACES_QUOTA", "Cuota de Google Places agotada");
      },
      getApiKey: () => "test-api-key",
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("POST", validBody, "application/json"), response);

    expect(captured).toEqual({
      status: 429,
      body: {error: {code: "PLACES_QUOTA", message: "Cuota de Google Places agotada"}},
    });
  });

  it("does not expose details from an unexpected error", async () => {
    const handler = createRecolectarHandler({
      async collect() {
        throw new Error("secret stack detail");
      },
      getApiKey: () => "test-api-key",
    });
    const {response, captured} = makeResponse();

    await handler(makeRequest("POST", validBody, "application/json"), response);

    expect(captured).toEqual({
      status: 500,
      body: {error: {code: "INTERNAL", message: "Error interno"}},
    });
  });
});
