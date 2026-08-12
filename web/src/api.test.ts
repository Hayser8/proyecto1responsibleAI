import {describe, expect, it, vi} from "vitest";

import {
  CollectionApiError,
  DirectoryApiError,
  collectDoctors,
  fetchDirectory,
} from "./api";

describe("fetchDirectory", () => {
  it("codifica la paginación y los filtros en la URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        data: [],
        pagination: {page: 2, pageSize: 20, returned: 0, hasNextPage: false},
        filters: {especialidad: "Pediatría", zona: "10"},
      }), {status: 200, headers: {"Content-Type": "application/json"}}),
    );

    await fetchDirectory(
      {page: 2, pageSize: 20, especialidad: "Pediatría", zona: "10"},
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/directorio?page=2&pageSize=20&especialidad=Pediatr%C3%ADa&zona=10",
      expect.objectContaining({headers: {Accept: "application/json"}}),
    );
  });

  it("convierte respuestas no exitosas en un error seguro", async () => {
    const unsafeResponse = "<h1>Internal Server Error</h1> Error: secret stack at /srv/app.ts:40";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(unsafeResponse, {status: 500}),
    );

    const request = fetchDirectory({page: 1, pageSize: 20}, fetchImpl);

    await expect(request).rejects.toBeInstanceOf(DirectoryApiError);
    await expect(request).rejects.toThrow("No se pudo consultar el directorio. Intente de nuevo.");
    await expect(request).rejects.not.toThrow(/Internal|stack|srv|<h1>/i);
  });
});

describe("collectDoctors", () => {
  const request = {
    keyword: "pediatra zona 10 Ciudad de Guatemala",
    especialidad: "Pediatría",
    zona: "10",
  };

  it("envía la solicitud de recolección y devuelve el resumen", async () => {
    const summary = {...request, encontrados: 8, creados: 5, actualizados: 3};
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(summary), {
        status: 200,
        headers: {"Content-Type": "application/json"},
      }),
    );

    await expect(collectDoctors(request, fetchImpl)).resolves.toEqual(summary);
    expect(fetchImpl).toHaveBeenCalledWith("/recolectarMedicos", {
      method: "POST",
      headers: {Accept: "application/json", "Content-Type": "application/json"},
      body: JSON.stringify({
        keyword: "pediatra zona 10 Ciudad de Guatemala",
        especialidad: "Pediatría",
        zona: "10",
      }),
    });
  });

  it.each([
    [400, "Revise la keyword, especialidad y zona."],
    [429, "Se alcanzó la cuota de Google Places. Intente mañana."],
    [500, "No se pudo recolectar desde Google Places. Intente de nuevo."],
  ])("devuelve un error seguro para HTTP %i", async (status, safeMessage) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<h1>Internal Server Error</h1> secret stack at /srv/app.ts:40", {status}),
    );

    const result = collectDoctors(request, fetchImpl);

    await expect(result).rejects.toBeInstanceOf(CollectionApiError);
    await expect(result).rejects.toThrow(safeMessage);
    await expect(result).rejects.not.toThrow(/Internal|secret|stack|srv|<h1>/i);
  });

  it.each([
    ["null", "null"],
    ["un arreglo", "[]"],
    ["campos de solicitud distintos", JSON.stringify({...request, keyword: "cardiólogo zona 9", encontrados: 8, creados: 5, actualizados: 3})],
    ["un campo de solicitud no string", JSON.stringify({...request, zona: 10, encontrados: 8, creados: 5, actualizados: 3})],
    ["un contador faltante", JSON.stringify({...request, encontrados: 8, creados: 5})],
    ["un contador negativo", JSON.stringify({...request, encontrados: 8, creados: -1, actualizados: 3})],
    ["un contador fraccionario", JSON.stringify({...request, encontrados: 8.5, creados: 5, actualizados: 3})],
    ["un contador no finito", `{"keyword":"${request.keyword}","especialidad":"${request.especialidad}","zona":"${request.zona}","encontrados":1e400,"creados":5,"actualizados":3}`],
  ])("rechaza una respuesta 2xx malformada con %s", async (_caseName, body) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(body, {status: 200, headers: {"Content-Type": "application/json"}}),
    );

    const result = collectDoctors(request, fetchImpl);

    await expect(result).rejects.toBeInstanceOf(CollectionApiError);
    await expect(result).rejects.toThrow("No se pudo recolectar desde Google Places. Intente de nuevo.");
  });
});
