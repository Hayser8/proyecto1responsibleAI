import {describe, expect, it} from "vitest";
import {HttpError} from "../../src/shared/http.js";
import {parseRecolectarInput} from "../../src/recoleccion/validation.js";

function expectInvalidRequest(body: unknown): void {
  try {
    parseRecolectarInput(body);
    throw new Error("Expected parseRecolectarInput to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({status: 400, code: "INVALID_REQUEST"});
  }
}

describe("parseRecolectarInput", () => {
  it("returns a valid collection request", () => {
    expect(parseRecolectarInput({
      keyword: "  pediatra   infantil zona 10  ",
      zona: "10",
      especialidad: "Pediatría",
    })).toEqual({
      keyword: "pediatra infantil zona 10",
      zona: "10",
      especialidad: "Pediatría",
    });
  });

  it("accepts a free keyword independently from the catalog specialty", () => {
    expect(parseRecolectarInput({
      keyword: "clínica infantil abierta 24 horas",
      zona: "10",
      especialidad: "Pediatría",
    })).toEqual({
      keyword: "clínica infantil abierta 24 horas",
      zona: "10",
      especialidad: "Pediatría",
    });
  });

  it("rejects a non-numeric zone", () => {
    expectInvalidRequest({keyword: "pediatra", zona: "abc", especialidad: "Pediatría"});
  });

  it("rejects an empty specialty", () => {
    expectInvalidRequest({keyword: "pediatra", zona: "10", especialidad: ""});
  });

  it("normalizes whitespace and returns the canonical catalog value", () => {
    expect(parseRecolectarInput({
      keyword: "  pediatra   zona 10 ",
      zona: "10",
      especialidad: "  Pediatría   ",
    })).toEqual({
      keyword: "pediatra zona 10",
      zona: "10",
      especialidad: "Pediatría",
    });
  });

  it("rejects a specialty outside the allowed catalog", () => {
    expectInvalidRequest({
      keyword: "pediatra",
      zona: "10",
      especialidad: "car",
    });
  });

  it("rejects invalid body shapes and boundary violations", () => {
    expectInvalidRequest(null);
    expectInvalidRequest([]);
    expectInvalidRequest({keyword: "pediatra", zona: "0", especialidad: "Pediatría"});
    expectInvalidRequest({keyword: "pediatra", zona: "26", especialidad: "Pediatría"});
    expectInvalidRequest({keyword: "pediatra", zona: "10", especialidad: "ab"});
    expectInvalidRequest({keyword: "", zona: "10", especialidad: "Pediatría"});
    expectInvalidRequest({keyword: "x".repeat(121), zona: "10", especialidad: "Pediatría"});
  });
});
