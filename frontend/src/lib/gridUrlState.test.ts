import type { GridColDef } from "@mui/x-data-grid";
import { describe, expect, it } from "vitest";

import {
  filterOperatorsFor,
  parseGridState,
  serializeGridState,
  type GridUrlOptions,
  type GridUrlState,
} from "./gridUrlState";

const columns: GridColDef[] = [
  { field: "id", type: "number" },
  { field: "sprite", sortable: false, filterable: false },
  { field: "name" },
  { field: "type" },
  { field: "power", type: "number" },
  { field: "is_default", type: "boolean" },
  { field: "effect" },
];
const options: GridUrlOptions = { columns, pageSizeOptions: [25, 50, 100], defaultPageSize: 25 };
const parse = (qs: string) => parseGridState(new URLSearchParams(qs), options);
const serialize = (state: GridUrlState) => serializeGridState(state, options);

const DEFAULT: GridUrlState = {
  paginationModel: { page: 0, pageSize: 25 },
  sortModel: [],
  filterModel: { items: [] },
  columnVisibilityModel: {},
};

describe("parseGridState", () => {
  it("gives the default view for an empty query", () => {
    expect(parse("")).toEqual(DEFAULT);
  });

  it("reads a full view", () => {
    expect(parse("filter=type&op=equals&value=fire&sort=-power&page=2&pageSize=50&q=fire%20punch&hide=effect,sprite")).toEqual({
      paginationModel: { page: 1, pageSize: 50 },
      sortModel: [{ field: "power", sort: "desc" }],
      filterModel: {
        items: [{ id: 1, field: "type", operator: "equals", value: "fire" }],
        quickFilterValues: ["fire", "punch"],
      },
      columnVisibilityModel: { effect: false, sprite: false },
    });
  });

  it("sorts ascending without a prefix", () => {
    expect(parse("sort=name").sortModel).toEqual([{ field: "name", sort: "asc" }]);
  });

  it("turns number filter values into numbers (the grid compares strictly)", () => {
    expect(parse("filter=power&op=%3E%3D&value=90").filterModel.items).toEqual([
      { id: 1, field: "power", operator: ">=", value: 90 },
    ]);
  });

  it("reads repeated values for isAnyOf", () => {
    expect(parse("filter=power&op=isAnyOf&value=40&value=90").filterModel.items[0].value).toEqual([40, 90]);
    expect(parse("filter=type&op=isAnyOf&value=fire&value=water").filterModel.items[0].value).toEqual([
      "fire",
      "water",
    ]);
  });

  it("needs no value for isEmpty / isNotEmpty", () => {
    expect(parse("filter=effect&op=isEmpty").filterModel.items).toEqual([
      { id: 1, field: "effect", operator: "isEmpty" },
    ]);
  });

  it("keeps boolean filter values as the grid's 'true'/'false' strings", () => {
    expect(parse("filter=is_default&op=is&value=false").filterModel.items[0].value).toBe("false");
  });

  it.each([
    ["unknown page", "page=abc", DEFAULT],
    ["page 0", "page=0", DEFAULT],
    ["negative page", "page=-2", DEFAULT],
    ["page size not offered (MIT max 100)", "pageSize=500", DEFAULT],
    ["unknown sort column", "sort=-nope", DEFAULT],
    ["unsortable column", "sort=sprite", DEFAULT],
    ["unknown filter column", "filter=nope&op=equals&value=x", DEFAULT],
    ["unfilterable column", "filter=sprite&op=equals&value=x", DEFAULT],
    ["filter without operator", "filter=type&value=fire", DEFAULT],
    ["odd operator", "filter=type&op=%3Cscript%3E&value=x", DEFAULT],
    ["string operator on a number column", "filter=power&op=contains&value=5", DEFAULT],
    ["number operator on a string column", "filter=name&op=%3E&value=5", DEFAULT],
    ["boolean operator on a string column", "filter=name&op=is&value=true", DEFAULT],
    ["string operator on a boolean column", "filter=is_default&op=contains&value=t", DEFAULT],
    ["filter without value", "filter=type&op=equals", DEFAULT],
    ["empty filter value", "filter=type&op=equals&value=", DEFAULT],
    ["non-numeric number value", "filter=power&op=%3D&value=lots", DEFAULT],
    ["blank quick search", "q=%20%20", DEFAULT],
    ["unknown hidden columns", "hide=nope,", DEFAULT],
  ])("ignores %s", (_, qs, expected) => {
    expect(parse(qs)).toEqual(expected);
  });

  it("never hides the id column", () => {
    expect(parse("hide=id,name").columnVisibilityModel).toEqual({ name: false });
  });

  it("drops non-numeric entries from a numeric isAnyOf", () => {
    expect(parse("filter=power&op=isAnyOf&value=x&value=50").filterModel.items[0].value).toEqual([50]);
    expect(parse("filter=power&op=isAnyOf&value=x").filterModel.items).toEqual([]);
  });
});

describe("serializeGridState", () => {
  it("is empty for the default view", () => {
    expect(serialize(DEFAULT)).toBe("");
  });

  it("writes every non-default part", () => {
    const qs = serialize({
      paginationModel: { page: 2, pageSize: 100 },
      sortModel: [{ field: "name", sort: "asc" }],
      filterModel: { items: [{ id: 1, field: "type", operator: "contains", value: "ire" }], quickFilterValues: ["punch"] },
      columnVisibilityModel: { effect: false, name: true },
    });
    expect(Object.fromEntries(new URLSearchParams(qs))).toEqual({
      filter: "type",
      op: "contains",
      value: "ire",
      q: "punch",
      sort: "name",
      page: "3",
      pageSize: "100",
      hide: "effect",
    });
  });

  it("skips filter items still waiting for a value", () => {
    const state = { ...DEFAULT, filterModel: { items: [{ id: 1, field: "type", operator: "equals" }] } };
    expect(serialize(state)).toBe("");
    const empty = { ...DEFAULT, filterModel: { items: [{ id: 1, field: "type", operator: "isAnyOf", value: [] }] } };
    expect(serialize(empty)).toBe("");
  });

  it("writes valueless operators and multi-value filters", () => {
    expect(serialize({ ...DEFAULT, filterModel: { items: [{ id: 1, field: "effect", operator: "isNotEmpty" }] } })).toBe(
      "filter=effect&op=isNotEmpty",
    );
    expect(
      serialize({ ...DEFAULT, filterModel: { items: [{ id: 1, field: "power", operator: "isAnyOf", value: [40, 90] }] } }),
    ).toBe("filter=power&op=isAnyOf&value=40&value=90");
  });

  it("ignores a sort entry without a direction", () => {
    expect(serialize({ ...DEFAULT, sortModel: [{ field: "name", sort: null }] })).toBe("");
  });
});

describe("round trip", () => {
  it.each([
    "filter=type&op=equals&value=fire&q=fire+punch&sort=-power&page=2&pageSize=50&hide=sprite%2Ceffect",
    "filter=power&op=isAnyOf&value=40&value=90",
    "filter=effect&op=isEmpty",
    "filter=is_default&op=is&value=true&sort=name",
    "q=thunder",
  ])("%s", (qs) => {
    expect(serialize(parse(qs))).toBe(qs);
  });
});

describe("filterOperatorsFor", () => {
  it("offers MUI's operators for the column type", () => {
    expect(filterOperatorsFor({ field: "a" })).toContain("contains");
    expect(filterOperatorsFor({ field: "a", type: "number" })).toEqual(["=", "!=", ">", ">=", "<", "<=", "isEmpty", "isNotEmpty", "isAnyOf"]);
    expect(filterOperatorsFor({ field: "a", type: "boolean" })).toEqual(["is"]);
    expect(filterOperatorsFor({ field: "a", type: "singleSelect" })).toEqual(["is", "not", "isAnyOf"]);
    expect(filterOperatorsFor({ field: "a", type: "date" })).toContain("after");
  });

  it("prefers a column's own operators", () => {
    const column = { field: "a", filterOperators: [{ value: "custom", getApplyFilterFn: () => null }] };
    expect(filterOperatorsFor(column)).toEqual(["custom"]);
    const parsed = parseGridState(new URLSearchParams("filter=a&op=custom&value=x"), {
      ...options,
      columns: [column],
    });
    expect(parsed.filterModel.items).toEqual([{ id: 1, field: "a", operator: "custom", value: "x" }]);
  });
});
