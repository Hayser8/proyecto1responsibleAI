import "./styles.css";

import {collectDoctors, CollectionApiError, DirectoryApiError, fetchDirectory} from "./api";
import type {CollectionSummary, DirectoryPage, MedicoDto} from "./types";

interface UiState {
  page: number;
  pageSize: number;
  especialidad?: string;
  zona?: string;
  loading: boolean;
  error?: string;
  result?: DirectoryPage;
  collectionLoading: boolean;
  collectionError?: string;
  collectionSummary?: CollectionSummary;
}

interface AppElements {
  collectionForm: HTMLFormElement;
  keyword: HTMLInputElement;
  collectionSpecialty: HTMLSelectElement;
  collectionZone: HTMLSelectElement;
  collectionSubmit: HTMLButtonElement;
  collectionStatus: HTMLParagraphElement;
  collectionError: HTMLParagraphElement;
  form: HTMLFormElement;
  specialty: HTMLSelectElement;
  zone: HTMLSelectElement;
  submit: HTMLButtonElement;
  status: HTMLParagraphElement;
  error: HTMLParagraphElement;
  results: HTMLDivElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  page: HTMLSpanElement;
}

function makeElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function appendOptions(select: HTMLSelectElement, values: string[], emptyLabel: string): void {
  const emptyOption = makeElement("option", undefined, emptyLabel);
  emptyOption.value = "";
  select.append(emptyOption);
  for (const value of values) {
    const option = makeElement("option", undefined, value);
    option.value = value;
    select.append(option);
  }
}

function createShell(root: HTMLElement): AppElements {
  const page = makeElement("div", "page-shell");
  const header = makeElement("header", "record-header");
  const headerText = makeElement("div");
  headerText.append(
    makeElement("p", "eyebrow", "Directorio académico · Ciudad de Guatemala"),
    makeElement("h1", undefined, "Especialistas médicos"),
    makeElement("p", "intro", "Consulte registros por especialidad y zona para revisar rápidamente la información disponible."),
  );
  const stamp = makeElement("p", "collection-stamp");
  stamp.append(
    makeElement("span", "stamp-label", "Fecha de recolección"),
    makeElement("span", "stamp-detail", "Visible en cada registro"),
  );
  header.append(headerText, stamp);

  const main = makeElement("main");
  main.id = "contenido-principal";
  const collectionSection = makeElement("section", "record-card collection-card");
  collectionSection.setAttribute("aria-labelledby", "collection-heading");
  const collectionHeading = makeElement("h2", undefined, "Recolectar desde Google Places");
  collectionHeading.id = "collection-heading";
  const collectionForm = makeElement("form", "collection-form");
  collectionForm.setAttribute("aria-label", "Recolectar médicos desde Google Places");

  const keywordField = makeElement("div", "field");
  const keywordLabel = makeElement("label", undefined, "Keyword");
  keywordLabel.htmlFor = "keyword";
  const keyword = makeElement("input");
  keyword.id = "keyword";
  keyword.name = "keyword";
  keyword.type = "text";
  keyword.required = true;
  keyword.value = "pediatra zona 10 Ciudad de Guatemala";
  keywordField.append(keywordLabel, keyword);

  const collectionSpecialtyField = makeElement("div", "field");
  const collectionSpecialtyLabel = makeElement("label", undefined, "Especialidad para guardar");
  collectionSpecialtyLabel.htmlFor = "collection-especialidad";
  const collectionSpecialty = makeElement("select");
  collectionSpecialty.id = "collection-especialidad";
  collectionSpecialty.name = "collection-especialidad";
  collectionSpecialty.required = true;
  appendOptions(collectionSpecialty, ["Pediatría", "Cardiología", "Dermatología"], "Seleccione una especialidad");
  collectionSpecialty.value = "Pediatría";
  collectionSpecialtyField.append(collectionSpecialtyLabel, collectionSpecialty);

  const collectionZoneField = makeElement("div", "field");
  const collectionZoneLabel = makeElement("label", undefined, "Zona para guardar");
  collectionZoneLabel.htmlFor = "collection-zona";
  const collectionZone = makeElement("select");
  collectionZone.id = "collection-zona";
  collectionZone.name = "collection-zona";
  collectionZone.required = true;
  appendOptions(collectionZone, ["1", "9", "10"], "Seleccione una zona");
  collectionZone.value = "10";
  collectionZoneField.append(collectionZoneLabel, collectionZone);

  const collectionSubmit = makeElement("button", "primary-button", "Recolectar desde Google Places");
  collectionSubmit.type = "submit";
  collectionForm.append(keywordField, collectionSpecialtyField, collectionZoneField, collectionSubmit);
  const quotaNotice = makeElement("p", "quota-notice", "Cada envío consume una solicitud de la cuota de Google Places.");
  const collectionStatus = makeElement("p", "status-message", "Complete los campos para iniciar una recolección.");
  collectionStatus.setAttribute("aria-live", "polite");
  collectionStatus.setAttribute("aria-atomic", "true");
  const collectionError = makeElement("p", "error-message");
  collectionError.setAttribute("role", "alert");
  collectionError.hidden = true;
  collectionSection.append(collectionHeading, collectionForm, quotaNotice, collectionStatus, collectionError);

  const filterSection = makeElement("section", "record-card");
  filterSection.setAttribute("aria-labelledby", "filter-heading");
  const filterHeading = makeElement("h2", undefined, "Filtrar directorio");
  filterHeading.id = "filter-heading";
  const form = makeElement("form", "filter-form");
  form.setAttribute("aria-label", "Filtros del directorio");

  const specialtyField = makeElement("div", "field");
  const specialtyLabel = makeElement("label", undefined, "Especialidad");
  specialtyLabel.htmlFor = "especialidad";
  const specialty = makeElement("select");
  specialty.id = "especialidad";
  specialty.name = "especialidad";
  appendOptions(specialty, ["Pediatría", "Cardiología", "Dermatología"], "Todas las especialidades");
  specialtyField.append(specialtyLabel, specialty);

  const zoneField = makeElement("div", "field");
  const zoneLabel = makeElement("label", undefined, "Zona de la ciudad");
  zoneLabel.htmlFor = "zona";
  const zone = makeElement("select");
  zone.id = "zona";
  zone.name = "zona";
  appendOptions(zone, ["1", "9", "10"], "Todas las zonas");
  zoneField.append(zoneLabel, zone);

  const submit = makeElement("button", "primary-button", "Buscar especialistas");
  submit.type = "submit";
  form.append(specialtyField, zoneField, submit);
  const status = makeElement("p", "status-message", "Seleccione filtros y realice una búsqueda.");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  const error = makeElement("p", "error-message");
  error.setAttribute("role", "alert");
  error.hidden = true;
  filterSection.append(filterHeading, form, status, error);

  const resultSection = makeElement("section", "record-card results-card");
  resultSection.setAttribute("aria-labelledby", "results-heading");
  const resultsHeading = makeElement("h2", undefined, "Resultados");
  resultsHeading.id = "results-heading";
  const results = makeElement("div", "results-content");
  const pagination = makeElement("nav", "pagination");
  pagination.setAttribute("aria-label", "Paginación de resultados");
  const previous = makeElement("button", "secondary-button", "Anterior");
  previous.type = "button";
  previous.setAttribute("aria-label", "Página anterior");
  const pageIndicator = makeElement("span", "page-indicator", "Página 1");
  const next = makeElement("button", "secondary-button", "Siguiente");
  next.type = "button";
  next.setAttribute("aria-label", "Página siguiente");
  pagination.append(previous, pageIndicator, next);
  resultSection.append(resultsHeading, results, pagination);

  const notice = makeElement("aside", "reference-notice", "Este directorio es una referencia académica y no certifica credenciales ni sustituye orientación médica profesional.");
  notice.setAttribute("aria-label", "Alcance del directorio");
  main.append(collectionSection, filterSection, resultSection, notice);
  page.append(header, main);
  root.replaceChildren(page);
  return {
    collectionForm,
    keyword,
    collectionSpecialty,
    collectionZone,
    collectionSubmit,
    collectionStatus,
    collectionError,
    form,
    specialty,
    zone,
    submit,
    status,
    error,
    results,
    previous,
    next,
    page: pageIndicator,
  };
}

function safeWebsite(value: string): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function formatCollectionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "No disponible";
  return new Intl.DateTimeFormat("es-GT", {dateStyle: "medium", timeStyle: "short"}).format(date);
}

function textCell(value: string, fallback = "No disponible"): HTMLTableCellElement {
  return makeElement("td", undefined, value || fallback);
}

function renderTable(data: MedicoDto[]): HTMLDivElement {
  const wrapper = makeElement("div", "table-scroll");
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", "Tabla de especialistas; desplácese horizontalmente para ver todas las columnas");
  const table = makeElement("table");
  const caption = makeElement("caption", undefined, "Especialistas encontrados en el directorio");
  const head = makeElement("thead");
  const headerRow = makeElement("tr");
  for (const label of ["Nombre", "Especialidad", "Dirección", "Teléfono", "Sitio web", "Zona", "Fecha de recolección"]) {
    const header = makeElement("th", undefined, label);
    header.scope = "col";
    headerRow.append(header);
  }
  head.append(headerRow);
  const body = makeElement("tbody");

  for (const doctor of data) {
    const row = makeElement("tr");
    const name = makeElement("th", "doctor-name", doctor.nombre);
    name.scope = "row";
    const websiteCell = makeElement("td");
    const website = safeWebsite(doctor.sitio_web);
    if (website) {
      const link = makeElement("a", "website-link", "Visitar sitio");
      link.href = website.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Visitar sitio de ${doctor.nombre}`);
      websiteCell.append(link);
    } else {
      websiteCell.textContent = "No disponible";
    }
    const zone = textCell(doctor.zona);
    zone.className = "data-value";
    const collectedAt = textCell(formatCollectionDate(doctor.fecha_recoleccion));
    collectedAt.className = "collection-date";
    row.append(name, textCell(doctor.especialidad), textCell(doctor.direccion), textCell(doctor.telefono), websiteCell, zone, collectedAt);
    body.append(row);
  }
  table.append(caption, head, body);
  wrapper.append(table);
  return wrapper;
}

export function mountDirectoryApp(root: HTMLElement, fetchImpl: typeof fetch = fetch): void {
  const elements = createShell(root);
  const state: UiState = {page: 1, pageSize: 20, loading: false, collectionLoading: false};
  let directoryRequestGeneration = 0;

  const render = (): void => {
    elements.collectionSubmit.disabled = state.collectionLoading;
    elements.keyword.disabled = state.collectionLoading;
    elements.collectionSpecialty.disabled = state.collectionLoading;
    elements.collectionZone.disabled = state.collectionLoading;
    elements.collectionForm.setAttribute("aria-busy", String(state.collectionLoading));
    elements.collectionError.hidden = !state.collectionError;
    elements.collectionError.textContent = state.collectionError ?? "";
    if (state.collectionLoading) {
      elements.collectionStatus.textContent = "Recolectando médicos desde Google Places…";
    } else if (state.collectionSummary) {
      const {encontrados, creados, actualizados} = state.collectionSummary;
      elements.collectionStatus.textContent = `${encontrados} encontrados, ${creados} creados y ${actualizados} actualizados.`;
    } else if (state.collectionError) {
      elements.collectionStatus.textContent = "La recolección no pudo completarse.";
    }

    elements.submit.disabled = state.loading;
    elements.specialty.disabled = state.loading;
    elements.zone.disabled = state.loading;
    elements.form.setAttribute("aria-busy", String(state.loading));
    elements.error.hidden = !state.error;
    elements.error.textContent = state.error ?? "";
    elements.page.textContent = `Página ${state.page}`;
    if (state.loading) {
      elements.status.textContent = "Consultando el directorio…";
    } else if (state.error) {
      elements.status.textContent = "La consulta no pudo completarse.";
    } else if (state.result) {
      const count = state.result.pagination.returned;
      elements.status.textContent = `${count} ${count === 1 ? "médico encontrado" : "médicos encontrados"}. Página ${state.page}.`;
    }

    elements.results.replaceChildren();
    if (state.result?.data.length) {
      elements.results.append(renderTable(state.result.data));
    } else if (state.result && !state.loading && !state.error) {
      const empty = makeElement("div", "empty-state");
      empty.append(
        makeElement("h3", undefined, "No se encontraron médicos"),
        makeElement("p", undefined, "Cambie la especialidad o la zona y vuelva a buscar."),
      );
      elements.results.append(empty);
    } else if (!state.loading && !state.error) {
      elements.results.append(makeElement("p", "initial-state", "Los registros aparecerán aquí después de buscar."));
    }
    elements.previous.disabled = state.loading || state.page <= 1;
    elements.next.disabled = state.loading || !state.result?.pagination.hasNextPage;
  };

  const requestPage = async (): Promise<void> => {
    const requestGeneration = ++directoryRequestGeneration;
    state.loading = true;
    state.error = undefined;
    render();
    try {
      const result = await fetchDirectory({page: state.page, pageSize: state.pageSize, especialidad: state.especialidad, zona: state.zona}, fetchImpl);
      if (requestGeneration === directoryRequestGeneration) {
        state.result = result;
      }
    } catch (error) {
      if (requestGeneration === directoryRequestGeneration) {
        state.result = undefined;
        state.error = error instanceof DirectoryApiError ? error.message : "No se pudo consultar el directorio. Intente de nuevo.";
      }
    } finally {
      if (requestGeneration === directoryRequestGeneration) {
        state.loading = false;
        render();
      }
    }
  };

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.page = 1;
    state.especialidad = elements.specialty.value || undefined;
    state.zona = elements.zone.value || undefined;
    void requestPage();
  });
  elements.collectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.collectionLoading) return;

    const keyword = elements.keyword.value.trim();
    const especialidad = elements.collectionSpecialty.value;
    const zona = elements.collectionZone.value;
    state.collectionError = undefined;
    state.collectionSummary = undefined;
    if (!keyword || !especialidad || !zona) {
      state.collectionError = "Revise la keyword, especialidad y zona.";
      render();
      return;
    }

    const requestCollection = async (): Promise<void> => {
      state.collectionLoading = true;
      render();
      try {
        const summary = await collectDoctors({keyword, especialidad, zona}, fetchImpl);
        state.collectionSummary = summary;
        state.especialidad = summary.especialidad;
        state.zona = summary.zona;
        elements.specialty.value = summary.especialidad;
        elements.zone.value = summary.zona;
        state.page = 1;
        await requestPage();
      } catch (error) {
        state.collectionError = error instanceof CollectionApiError
          ? error.message
          : "No se pudo recolectar desde Google Places. Intente de nuevo.";
      } finally {
        state.collectionLoading = false;
        render();
      }
    };

    void requestCollection();
  });
  elements.previous.addEventListener("click", () => {
    if (state.page <= 1 || state.loading) return;
    state.page -= 1;
    void requestPage();
  });
  elements.next.addEventListener("click", () => {
    if (!state.result?.pagination.hasNextPage || state.loading) return;
    state.page += 1;
    void requestPage();
  });
  render();
}

const app = document.querySelector<HTMLElement>("#app");
if (app) mountDirectoryApp(app);
