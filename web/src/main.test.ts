import {fireEvent, getByLabelText, getByRole, getByText, queryAllByText, queryByRole} from "@testing-library/dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {CollectionApiError, DirectoryApiError} from "./api";
import {mountDirectoryApp} from "./main";
import styles from "./styles.css?raw";
import type {DirectoryPage} from "./types";

const pageWithDoctor: DirectoryPage = {
  data: [
    {
      nombre: "Dra. Ana López",
      especialidad: "Pediatría",
      direccion: "6a avenida 1-20, zona 10",
      telefono: "",
      sitio_web: "https://clinica.example/perfil",
      zona: "10",
      place_id: "place-1",
      fecha_recoleccion: "2026-08-02T15:30:00.000Z",
      keyword_usado: "pediatra zona 10 Ciudad de Guatemala",
    },
    {
      nombre: "Dr. Luis Pérez",
      especialidad: "Cardiología",
      direccion: "4a avenida 8-15, zona 9",
      telefono: "2222-3333",
      sitio_web: "",
      zona: "9",
      place_id: "place-2",
      fecha_recoleccion: "2026-08-02T15:30:00.000Z",
      keyword_usado: "cardiólogo zona 9 Ciudad de Guatemala",
    },
  ],
  pagination: {page: 1, pageSize: 20, returned: 2, hasNextPage: false},
  filters: {especialidad: null, zona: null},
};

const emptyPage: DirectoryPage = {
  data: [],
  pagination: {page: 1, pageSize: 20, returned: 0, hasNextPage: false},
  filters: {especialidad: null, zona: null},
};

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("directorio de especialistas", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement("div");
    root.id = "app";
    document.body.append(root);
  });

  it("usa el token de acento legible en la ceja del directorio", () => {
    expect(styles).toContain("--accent-text: #087772;");
    expect(styles).toMatch(/\.eyebrow\s*\{[^}]*color:\s*var\(--accent-text\)/);
  });

  it("apila la recolección antes de 64rem y conserva el ajuste móvil", () => {
    expect(styles).toMatch(/\.collection-form\s*\{[^}]*display:\s*grid/);
    expect(styles).toMatch(/\.quota-notice\s*\{[^}]*border-left:/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*63\.99rem\)\s*\{[\s\S]*?\.collection-form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*47\.99rem\)\s*\{/);
  });

  it("asocia etiquetas visibles con los filtros iniciales", () => {
    mountDirectoryApp(root, vi.fn<typeof fetch>());

    expect(getByLabelText(root, "Especialidad")).toBeInstanceOf(HTMLInputElement);
    const zone = getByLabelText(root, "Zona de la ciudad");
    expect(zone).toBeInstanceOf(HTMLSelectElement);
    expect(zone.querySelectorAll("option")).toHaveLength(26);
    expect(zone.querySelector("option[value='25']")).not.toBeNull();
    expect((getByRole(root, "button", {name: "Buscar especialistas"}) as HTMLButtonElement).disabled).toBe(false);
  });

  it("presenta una tarjeta de recolección con campos explícitos y aviso de cuota", () => {
    mountDirectoryApp(root, vi.fn<typeof fetch>());

    expect(getByRole(root, "form", {name: "Recolectar médicos desde Google Places"})).toBeInstanceOf(HTMLFormElement);
    expect(getByLabelText(root, "Keyword")).toBeInstanceOf(HTMLInputElement);
    expect(getByLabelText(root, "Especialidad para guardar")).toBeInstanceOf(HTMLInputElement);
    const collectionZone = getByLabelText(root, "Zona para guardar");
    expect(collectionZone).toBeInstanceOf(HTMLSelectElement);
    expect(collectionZone.querySelectorAll("option")).toHaveLength(26);
    expect(collectionZone.querySelector("option[value='25']")).not.toBeNull();
    expect((getByLabelText(root, "Keyword") as HTMLInputElement).value).toBe("Pediatría zona 10 Ciudad de Guatemala");
    expect(getByRole(root, "button", {name: "Recolectar desde Google Places"})).toBeInstanceOf(HTMLButtonElement);
    expect(getByText(root, /cada envío consume una solicitud de la cuota/i)).toBeInstanceOf(HTMLElement);
    expect(queryAllByText(root, /Escriba (una especialidad o elija una sugerencia|para filtrar o déjelo vacío para ver todas)/i)).toHaveLength(0);
  });

  it("permite editar la keyword usada para consultar Google Places", () => {
    mountDirectoryApp(root, vi.fn<typeof fetch>());

    const keyword = getByLabelText(root, "Keyword") as HTMLInputElement;
    expect(keyword).toBeInstanceOf(HTMLInputElement);
    expect(keyword.name).toBe("keyword");
    expect(keyword.maxLength).toBe(120);

    keyword.value = "pediatra infantil abierto 24 horas";
    fireEvent.input(keyword);

    expect(keyword.value).toBe("pediatra infantil abierto 24 horas");
  });

  it("actualiza la keyword sugerida mientras la persona no la personaliza", () => {
    mountDirectoryApp(root, vi.fn<typeof fetch>());
    const specialty = getByLabelText(root, "Especialidad para guardar") as HTMLInputElement;
    const zone = getByLabelText(root, "Zona para guardar") as HTMLSelectElement;

    specialty.value = "Cardiología";
    fireEvent.input(specialty);
    zone.value = "9";
    fireEvent.change(zone);

    expect((getByLabelText(root, "Keyword") as HTMLInputElement).value).toBe("Cardiología zona 9 Ciudad de Guatemala");
  });

  it("muestra la especialidad canónica en la consulta generada", () => {
    mountDirectoryApp(root, vi.fn<typeof fetch>());
    const specialty = getByLabelText(root, "Especialidad para guardar") as HTMLInputElement;

    specialty.value = "pediatria";
    fireEvent.input(specialty);

    expect((getByLabelText(root, "Keyword") as HTMLInputElement).value).toBe("Pediatría zona 10 Ciudad de Guatemala");
  });

  it("permite escribir especialidades y ofrece sugerencias ampliadas", () => {
    mountDirectoryApp(root, vi.fn<typeof fetch>());

    const collectionSpecialty = getByLabelText(root, "Especialidad para guardar") as HTMLInputElement;
    const filterSpecialty = getByLabelText(root, "Especialidad") as HTMLInputElement;

    expect(collectionSpecialty.getAttribute("list")).toBe("especialidades-sugeridas");
    expect(filterSpecialty.getAttribute("list")).toBe("especialidades-sugeridas");
    expect(root.querySelectorAll("#especialidades-sugeridas option").length).toBeGreaterThan(10);
    expect(root.querySelector("#especialidades-sugeridas option[value='Gastroenterología']")).not.toBeNull();

    collectionSpecialty.value = "Nefrología pediátrica";
    expect(collectionSpecialty.value).toBe("Nefrología pediátrica");
  });

  it("no ejecuta la búsqueda para una especialidad fuera del catálogo", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    mountDirectoryApp(root, fetchImpl);

    const specialty = getByLabelText(root, "Especialidad") as HTMLInputElement;
    specialty.value = "car";
    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(getByRole(root, "alert").textContent).toContain("Seleccione una especialidad del catálogo.");
  });

  it("no ejecuta la recolección para una especialidad fuera del catálogo", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    mountDirectoryApp(root, fetchImpl);

    const specialty = getByLabelText(root, "Especialidad para guardar") as HTMLInputElement;
    specialty.value = "car";
    fireEvent.submit(getByRole(root, "form", {name: "Recolectar médicos desde Google Places"}));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(getByRole(root, "alert").textContent).toContain("Seleccione una especialidad del catálogo.");
  });

  it("recolecta, muestra el resumen y refresca el directorio con los filtros guardados", async () => {
    const collection = {
      keyword: "Pediatría zona 10 Ciudad de Guatemala",
      especialidad: "Pediatría",
      zona: "10",
      encontrados: 20,
      creados: 18,
      actualizados: 2,
    };
    const refreshedPage: DirectoryPage = {
      ...pageWithDoctor,
      filters: {especialidad: "Pediatría", zona: "10"},
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(collection), {status: 200}))
      .mockResolvedValueOnce(new Response(JSON.stringify(refreshedPage), {status: 200}));
    mountDirectoryApp(root, fetchImpl);

    fireEvent.submit(getByRole(root, "form", {name: "Recolectar médicos desde Google Places"}));

    await vi.waitFor(() => getByText(root, /20 encontrados, 18 creados y 2 actualizados/i));
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "/recolectarMedicos", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: "Pediatría zona 10 Ciudad de Guatemala",
        especialidad: "Pediatría",
        zona: "10",
      }),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "/directorio?page=1&pageSize=20&especialidad=Pediatr%C3%ADa&zona=10", {
      headers: {Accept: "application/json"},
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((getByLabelText(root, "Especialidad") as HTMLInputElement).value).toBe("Pediatría");
    expect((getByLabelText(root, "Zona de la ciudad") as HTMLSelectElement).value).toBe("10");
  });

  it("bloquea solo la recolección pendiente y comunica su error sin consultar el directorio", async () => {
    let rejectCollection: ((reason?: unknown) => void) | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((_resolve, reject) => {
      rejectCollection = reject;
    }));
    mountDirectoryApp(root, fetchImpl);

    fireEvent.submit(getByRole(root, "form", {name: "Recolectar médicos desde Google Places"}));
    fireEvent.submit(getByRole(root, "form", {name: "Recolectar médicos desde Google Places"}));

    expect((getByRole(root, "button", {name: "Recolectar desde Google Places"}) as HTMLButtonElement).disabled).toBe(true);
    expect((getByLabelText(root, "Especialidad para guardar") as HTMLInputElement).disabled).toBe(true);
    expect((getByLabelText(root, "Zona para guardar") as HTMLSelectElement).disabled).toBe(true);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    rejectCollection?.(new CollectionApiError("Se alcanzó la cuota de Google Places. Intente mañana."));
    const alert = await vi.waitFor(() => getByRole(root, "alert"));
    expect(alert.textContent).toContain("Se alcanzó la cuota de Google Places. Intente mañana.");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/recolectarMedicos");
  });

  it("conserva el resultado del GET automático cuando un GET manual anterior termina al final", async () => {
    const manualDirectory = deferred<Response>();
    const collectionRequest = deferred<Response>();
    const automaticDirectory = deferred<Response>();
    const stalePage: DirectoryPage = {
      ...pageWithDoctor,
      data: [{...pageWithDoctor.data[0]!, nombre: "Resultado manual obsoleto"}],
      pagination: {...pageWithDoctor.pagination, returned: 1},
    };
    const currentPage: DirectoryPage = {
      ...pageWithDoctor,
      data: [{...pageWithDoctor.data[0]!, nombre: "Resultado automático vigente"}],
      pagination: {...pageWithDoctor.pagination, returned: 1},
      filters: {especialidad: "Pediatría", zona: "10"},
    };
    const summary = {
      keyword: "Pediatría zona 10 Ciudad de Guatemala",
      especialidad: "Pediatría",
      zona: "10",
      encontrados: 1,
      creados: 1,
      actualizados: 0,
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => manualDirectory.promise)
      .mockImplementationOnce(() => collectionRequest.promise)
      .mockImplementationOnce(() => automaticDirectory.promise);
    mountDirectoryApp(root, fetchImpl);

    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));
    fireEvent.submit(getByRole(root, "form", {name: "Recolectar médicos desde Google Places"}));
    collectionRequest.resolve(new Response(JSON.stringify(summary), {status: 200}));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3));

    automaticDirectory.resolve(new Response(JSON.stringify(currentPage), {status: 200}));
    await vi.waitFor(() => getByText(root, "Resultado automático vigente"));
    manualDirectory.resolve(new Response(JSON.stringify(stalePage), {status: 200}));
    await flushAsyncWork();

    expect(getByText(root, "Resultado automático vigente")).toBeInstanceOf(HTMLElement);
    expect(queryByRole(root, "alert")).toBeNull();
    expect(queryAllByText(root, "Resultado manual obsoleto")).toHaveLength(0);
    expect((getByRole(root, "button", {name: "Buscar especialistas"}) as HTMLButtonElement).disabled).toBe(false);
  });

  it("ignora el error y el fin de carga de un GET obsoleto mientras el GET vigente sigue pendiente", async () => {
    const manualDirectory = deferred<Response>();
    const collectionRequest = deferred<Response>();
    const automaticDirectory = deferred<Response>();
    const summary = {
      keyword: "Pediatría zona 10 Ciudad de Guatemala",
      especialidad: "Pediatría",
      zona: "10",
      encontrados: 0,
      creados: 0,
      actualizados: 0,
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => manualDirectory.promise)
      .mockImplementationOnce(() => collectionRequest.promise)
      .mockImplementationOnce(() => automaticDirectory.promise);
    mountDirectoryApp(root, fetchImpl);

    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));
    fireEvent.submit(getByRole(root, "form", {name: "Recolectar médicos desde Google Places"}));
    collectionRequest.resolve(new Response(JSON.stringify(summary), {status: 200}));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3));

    manualDirectory.reject(new Error("fallo obsoleto"));
    await flushAsyncWork();

    expect(getByRole(root, "status", {name: "Estado del directorio"}).textContent).toBe("Consultando el directorio…");
    expect((getByRole(root, "button", {name: "Buscar especialistas"}) as HTMLButtonElement).disabled).toBe(true);
    expect(queryByRole(root, "alert")).toBeNull();

    automaticDirectory.resolve(new Response(JSON.stringify(emptyPage), {status: 200}));
    await vi.waitFor(() => getByText(root, "No se encontraron médicos"));
  });

  it("al enviar muestra nombres, enlaces seguros y faltantes explícitos", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(pageWithDoctor), {status: 200}),
    );
    mountDirectoryApp(root, fetchImpl);

    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));

    expect(root.contains(await vi.waitFor(() => getByText(root, "Dra. Ana López")))).toBe(true);
    expect(root.contains(getByText(root, "Dr. Luis Pérez"))).toBe(true);
    const site = getByRole(root, "link", {name: "Visitar sitio de Dra. Ana López"});
    expect(site.getAttribute("href")).toBe("https://clinica.example/perfil");
    expect(site.getAttribute("target")).toBe("_blank");
    expect(site.getAttribute("rel")).toBe("noopener noreferrer");
    expect(queryAllByText(root, "No disponible")).toHaveLength(2);
    expect(getByRole(root, "table", {name: "Especialistas encontrados en el directorio"})).toBeInstanceOf(HTMLTableElement);
    expect(root.querySelectorAll("thead th[scope='col']")).toHaveLength(7);
  });

  it("explica cuando la consulta no tiene médicos", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(emptyPage), {status: 200}),
    );
    mountDirectoryApp(root, fetchImpl);

    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));

    expect(root.contains(await vi.waitFor(() => getByText(root, "No se encontraron médicos")))).toBe(true);
    expect(getByText(root, /directorio está conectado, pero todavía no tiene registros/i)).toBeInstanceOf(HTMLElement);
  });

  it("anuncia un error seguro sin detalles del servidor", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(
      new DirectoryApiError("No se pudo consultar el directorio. Intente de nuevo."),
    );
    mountDirectoryApp(root, fetchImpl);

    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));

    const alert = await vi.waitFor(() => getByRole(root, "alert"));
    expect(alert.textContent).toContain("No se pudo consultar el directorio. Intente de nuevo.");
    expect(alert.textContent).not.toMatch(/stack|html|servidor/i);
  });

  it("deshabilita Anterior en página 1 y Siguiente sin más páginas", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(pageWithDoctor), {status: 200}),
    );
    mountDirectoryApp(root, fetchImpl);

    expect((getByRole(root, "button", {name: "Página anterior"}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));

    await vi.waitFor(() => getByText(root, "Dra. Ana López"));
    expect((getByRole(root, "button", {name: "Página anterior"}) as HTMLButtonElement).disabled).toBe(true);
    expect((getByRole(root, "button", {name: "Página siguiente"}) as HTMLButtonElement).disabled).toBe(true);
    expect(queryByRole(root, "alert")).toBeNull();
  });

  it("mantiene estable el estado anunciado y conserva la etiqueta durante la carga", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    mountDirectoryApp(root, fetchImpl);
    const status = getByRole(root, "status", {name: "Estado del directorio"});
    const submit = getByRole(root, "button", {name: "Buscar especialistas"}) as HTMLButtonElement;

    fireEvent.submit(getByRole(root, "form", {name: "Filtros del directorio"}));

    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toBe("Buscar especialistas");
    expect(getByRole(root, "status", {name: "Estado del directorio"})).toBe(status);
    expect(status.textContent).toBe("Consultando el directorio…");

    resolveRequest?.(new Response(JSON.stringify(emptyPage), {status: 200}));
    await vi.waitFor(() => getByText(root, "No se encontraron médicos"));
    expect(submit.disabled).toBe(false);
    expect(getByRole(root, "status", {name: "Estado del directorio"})).toBe(status);
  });
});
