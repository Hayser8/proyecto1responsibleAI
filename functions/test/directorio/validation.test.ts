import {describe, expect, it} from "vitest";
import {parseDirectoryQuery} from "../../src/directorio/validation.js";
import {HttpError} from "../../src/shared/http.js";

function expectInvalidQuery(query: Record<string, unknown>): void {
  try {
    parseDirectoryQuery(query);
    throw new Error("Expected parseDirectoryQuery to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({status: 400, code: "INVALID_REQUEST"});
  }
}

describe("parseDirectoryQuery", () => {
  it("uses the documented pagination defaults", () => {
    expect(parseDirectoryQuery({})).toEqual({page: 1, pageSize: 20});
  });

  it("parses integer pagination and trims exact filters", () => {
    expect(parseDirectoryQuery({
      page: "2",
      pageSize: "50",
      especialidad: " Pediatría ",
      zona: "10",
    })).toEqual({
      page: 2,
      pageSize: 50,
      especialidad: "Pediatría",
      zona: "10",
    });
  });

  it.each([
    {page: "0"},
    {pageSize: "0"},
    {pageSize: "51"},
    {page: "1.5"},
    {page: "1e2"},
    {page: ""},
  ])("rejects invalid integer pagination: %j", (query) => {
    expectInvalidQuery(query);
  });

  it.each([
    {page: ["1", "2"]},
    {pageSize: ["20"]},
    {especialidad: ["Pediatría", "Cardiología"]},
    {zona: ["10"]},
  ])("rejects array and repeated parameter shapes: %j", (query) => {
    expectInvalidQuery(query);
  });

  it.each([
    {zona: "0"},
    {zona: "26"},
    {zona: "01"},
    {zona: "zona 10"},
  ])("rejects an invalid zone: %j", (query) => {
    expectInvalidQuery(query);
  });

  it("omits blank optional filters after trimming", () => {
    expect(parseDirectoryQuery({especialidad: "   ", zona: "  "})).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it("canonicalizes a specialty from the allowed catalog", () => {
    expect(parseDirectoryQuery({especialidad: "  Pediatría   "})).toEqual({
      page: 1,
      pageSize: 20,
      especialidad: "Pediatría",
    });
  });

  it("rejects a specialty outside the allowed catalog", () => {
    expectInvalidQuery({especialidad: "car"});
  });

  it("accepts the greatest page whose page-size-50 offset fits Firestore int32", () => {
    expect(parseDirectoryQuery({page: "42949673", pageSize: "50"})).toEqual({
      page: 42_949_673,
      pageSize: 50,
    });
  });

  it("rejects a page whose computed offset exceeds Firestore int32", () => {
    expectInvalidQuery({page: "42949674", pageSize: "50"});
  });

  it("rejects a huge safe page even when its page size is one", () => {
    expectInvalidQuery({page: "9007199254740991", pageSize: "1"});
  });
});
