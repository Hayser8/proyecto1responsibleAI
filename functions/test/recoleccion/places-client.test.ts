import {describe, expect, it} from "vitest";
import {createPlacesClient} from "../../src/recoleccion/places-client.js";
import {HttpError} from "../../src/shared/http.js";

const input = {
  keyword: "pediatra infantil con atención nocturna",
  especialidad: "Pediatría",
  zona: "10",
};

describe("createPlacesClient", () => {
  it("sends the documented Places Text Search request and returns only allowed fields", async () => {
    let request: {url: string; init: RequestInit} | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = {url: String(input), init: init ?? {}};
      return new Response(JSON.stringify({
        places: [{
          id: "place-1",
          displayName: {text: "Clínica Pediátrica", languageCode: "es"},
          formattedAddress: "Zona 10, Ciudad de Guatemala",
          nationalPhoneNumber: "+502 1234-5678",
          websiteUri: "https://example.com",
          rating: 5,
        }],
      }), {status: 200});
    };

    const result = await createPlacesClient(fetchImpl).search(
      input,
      "test-api-key",
    );

    expect(request).toBeDefined();
    expect(request?.url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(request?.init.method).toBe("POST");
    const headers = request?.init.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe(
      "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri",
    );
    expect(headers["X-Goog-Api-Key"]).toBe("test-api-key");
    expect(JSON.parse(String(request?.init.body))).toEqual({
      textQuery: "pediatra infantil con atención nocturna",
      pageSize: 20,
      languageCode: "es",
      regionCode: "GT",
    });
    expect(request?.url).not.toContain("test-api-key");
    expect(Object.entries(headers).filter(([, value]) => value.includes("test-api-key"))).toEqual([
      ["X-Goog-Api-Key", "test-api-key"],
    ]);
    expect(String(request?.init.body)).not.toContain("test-api-key");
    expect(result).toEqual([{
      id: "place-1",
      displayName: {text: "Clínica Pediátrica"},
      formattedAddress: "Zona 10, Ciudad de Guatemala",
      nationalPhoneNumber: "+502 1234-5678",
      websiteUri: "https://example.com",
    }]);
  });

  it("maps a quota response to a safe PLACES_QUOTA error without the API key", async () => {
    const client = createPlacesClient(async () => new Response(
      JSON.stringify({error: {message: "key test-api-key exhausted"}}),
      {status: 429},
    ));

    const error = await client.search(input, "test-api-key").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({status: 429, code: "PLACES_QUOTA"});
    expect((error as Error).message).not.toContain("test-api-key");
  });

  it("maps other non-success responses to a safe PLACES_ERROR error", async () => {
    const client = createPlacesClient(async () => new Response(
      JSON.stringify({error: {message: "provider detail test-api-key"}}),
      {status: 500},
    ));

    const error = await client.search(input, "test-api-key").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({status: 502, code: "PLACES_ERROR"});
    expect((error as Error).message).not.toContain("test-api-key");
  });

  it("sanitizes an HttpError thrown by the injected fetch implementation", async () => {
    const client = createPlacesClient(async () => {
      throw new HttpError(500, "WRAPPER_FAILURE", "request failed with test-api-key");
    });

    const error = await client.search(input, "test-api-key").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({status: 502, code: "PLACES_ERROR"});
    expect((error as Error).message).not.toContain("test-api-key");
  });

  it("maps malformed provider JSON to a safe PLACES_ERROR error", async () => {
    const client = createPlacesClient(async () => new Response("not valid json", {status: 200}));

    const error = await client.search(input, "test-api-key").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({status: 502, code: "PLACES_ERROR"});
    expect((error as Error).message).not.toContain("test-api-key");
  });

  it("defensively returns no more than 20 provider places", async () => {
    const places = Array.from({length: 21}, (_, index) => ({
      id: `place-${index + 1}`,
      formattedAddress: `Address ${index + 1}`,
      providerOnly: "must not be returned",
    }));
    const client = createPlacesClient(async () => new Response(JSON.stringify({places}), {status: 200}));

    const result = await client.search(input, "test-api-key");

    expect(result).toHaveLength(20);
    expect(result[19]).toEqual({id: "place-20", formattedAddress: "Address 20"});
  });
});
