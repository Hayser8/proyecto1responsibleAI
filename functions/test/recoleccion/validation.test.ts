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
      keyword: "pediatra zona 10 Ciudad de Guatemala",
      zona: "10",
      especialidad: "Pediatría",
    })).toEqual({
      keyword: "pediatra zona 10 Ciudad de Guatemala",
      zona: "10",
      especialidad: "Pediatría",
    });
  });

  it("rejects an empty keyword", () => {
    expectInvalidRequest({keyword: "", zona: "10", especialidad: "Pediatría"});
  });

  it("rejects a non-numeric zone", () => {
    expectInvalidRequest({keyword: "pediatra", zona: "abc", especialidad: "Pediatría"});
  });

  it("rejects an empty specialty", () => {
    expectInvalidRequest({keyword: "pediatra", zona: "10", especialidad: ""});
  });

  it("normalizes whitespace without inferring values", () => {
    expect(parseRecolectarInput({
      keyword: "  pediatra   zona 10  ",
      zona: "10",
      especialidad: "  Pediatría   neonatal ",
    })).toEqual({
      keyword: "pediatra zona 10",
      zona: "10",
      especialidad: "Pediatría neonatal",
    });
  });

  it("rejects invalid body shapes and boundary violations", () => {
    expectInvalidRequest(null);
    expectInvalidRequest([]);
    expectInvalidRequest({keyword: "ab", zona: "10", especialidad: "Pediatría"});
    expectInvalidRequest({keyword: "pediatra", zona: "0", especialidad: "Pediatría"});
    expectInvalidRequest({keyword: "pediatra", zona: "26", especialidad: "Pediatría"});
    expectInvalidRequest({keyword: "pediatra", zona: "10", especialidad: "ab"});
  });
});
