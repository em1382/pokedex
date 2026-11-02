import {
  getGridBooleanOperators,
  getGridDateOperators,
  getGridNumericOperators,
  getGridSingleSelectOperators,
  getGridStringOperators,
  type GridColDef,
  type GridColumnVisibilityModel,
  type GridFilterItem,
  type GridFilterModel,
  type GridPaginationModel,
  type GridSortModel,
} from "@mui/x-data-grid";

/**
 * Grid state <-> URL query string, so a grid view can be shared as a link:
 *
 *   /moves?filter=type&op=equals&value=fire&sort=-power&page=2&pageSize=50&q=punch&hide=effect
 *
 *   page      1-based page number (omitted for page 1)
 *   pageSize  one of the grid's page-size options (omitted for the default)
 *   sort      column field, "-" prefix for descending (MIT grid: one sort column)
 *   filter    column field of the filter (MIT grid: one filter item)
 *   op        filter operator, e.g. contains, equals, >, isEmpty
 *   value     filter value; repeated for multi-value operators (isAnyOf)
 *   q         quick search text
 *   hide      comma-separated hidden columns
 *
 * Unknown or invalid values are ignored, so a stale or hand-edited link still opens.
 * That includes operators the column doesn't offer: the grid throws on those.
 */

export interface GridUrlState {
  paginationModel: GridPaginationModel;
  sortModel: GridSortModel;
  filterModel: GridFilterModel;
  columnVisibilityModel: GridColumnVisibilityModel;
}

export interface GridUrlOptions {
  columns: readonly GridColDef[];
  pageSizeOptions: readonly number[];
  defaultPageSize: number;
}

/** Operators that need no value. */
const VALUELESS_OPERATORS = new Set(["isEmpty", "isNotEmpty"]);
/** Operators whose value is a list. */
const MULTI_VALUE_OPERATORS = new Set(["isAnyOf"]);

/** Operators DataGrid offers for a column: its own, or the defaults for its type. */
const DEFAULT_OPERATORS: Record<string, () => { value: string }[]> = {
  number: getGridNumericOperators,
  boolean: getGridBooleanOperators,
  singleSelect: getGridSingleSelectOperators,
  date: getGridDateOperators,
  dateTime: getGridDateOperators,
};

export function filterOperatorsFor(column: GridColDef): string[] {
  const operators = column.filterOperators ?? (DEFAULT_OPERATORS[column.type ?? ""] ?? getGridStringOperators)();
  return operators.map((o) => o.value);
}

export function parseGridState(params: URLSearchParams, options: GridUrlOptions): GridUrlState {
  const { columns, pageSizeOptions, defaultPageSize } = options;
  const byField = new Map(columns.map((c) => [c.field, c]));

  const pageNumber = positiveInt(params.get("page"));
  const pageSize = positiveInt(params.get("pageSize"));
  const paginationModel = {
    page: pageNumber ? pageNumber - 1 : 0,
    pageSize: pageSize && pageSizeOptions.includes(pageSize) ? pageSize : defaultPageSize,
  };

  const sort = params.get("sort") ?? "";
  const desc = sort.startsWith("-");
  const sortField = desc ? sort.slice(1) : sort;
  const sortable = byField.has(sortField) && byField.get(sortField)?.sortable !== false;
  const sortModel: GridSortModel = sortable ? [{ field: sortField, sort: desc ? "desc" : "asc" }] : [];

  const filterModel: GridFilterModel = { items: [] };
  const item = parseFilterItem(params, byField);
  if (item) filterModel.items.push(item);
  const q = params.get("q")?.trim();
  if (q) filterModel.quickFilterValues = q.split(/\s+/);

  const columnVisibilityModel: GridColumnVisibilityModel = {};
  for (const field of (params.get("hide") ?? "").split(",")) {
    if (byField.has(field) && field !== "id") columnVisibilityModel[field] = false;
  }

  return { paginationModel, sortModel, filterModel, columnVisibilityModel };
}

function parseFilterItem(
  params: URLSearchParams,
  byField: Map<string, GridColDef>,
): GridFilterItem | null {
  const field = params.get("filter");
  const operator = params.get("op");
  const column = field ? byField.get(field) : undefined;
  if (!field || !column || column.filterable === false || !operator) return null;
  if (!filterOperatorsFor(column).includes(operator)) return null;
  if (VALUELESS_OPERATORS.has(operator)) return { id: 1, field, operator };

  const raw = params.getAll("value");
  if (raw.length === 0 || raw.every((v) => v === "")) return null;
  // Number columns compare numbers strictly, so URL strings must become numbers.
  const coerce = (v: string) => (column.type === "number" ? Number(v) : v);
  if (MULTI_VALUE_OPERATORS.has(operator)) {
    const values = raw.map(coerce).filter((v) => !(typeof v === "number" && Number.isNaN(v)));
    return values.length ? { id: 1, field, operator, value: values } : null;
  }
  const value = coerce(raw[0]);
  if (typeof value === "number" && Number.isNaN(value)) return null;
  return { id: 1, field, operator, value };
}

/** Query string for a grid state, leaving out defaults (empty for the default view). */
export function serializeGridState(state: GridUrlState, options: GridUrlOptions): string {
  const params = new URLSearchParams();
  const { paginationModel, sortModel, filterModel, columnVisibilityModel } = state;

  const item = filterModel.items.find((i) => i.field && i.operator && hasValue(i));
  if (item) {
    params.set("filter", item.field);
    params.set("op", item.operator);
    for (const v of Array.isArray(item.value) ? item.value : item.value == null ? [] : [item.value]) {
      params.append("value", String(v));
    }
  }

  const q = (filterModel.quickFilterValues ?? []).map(String).join(" ").trim();
  if (q) params.set("q", q);

  const [sort] = sortModel;
  if (sort?.sort) params.set("sort", `${sort.sort === "desc" ? "-" : ""}${sort.field}`);

  if (paginationModel.page > 0) params.set("page", String(paginationModel.page + 1));
  if (paginationModel.pageSize !== options.defaultPageSize) {
    params.set("pageSize", String(paginationModel.pageSize));
  }

  const hidden = options.columns.map((c) => c.field).filter((f) => columnVisibilityModel[f] === false);
  if (hidden.length) params.set("hide", hidden.join(","));

  return params.toString();
}

function hasValue(item: GridFilterItem): boolean {
  if (VALUELESS_OPERATORS.has(item.operator)) return true;
  if (Array.isArray(item.value)) return item.value.length > 0;
  return item.value != null && item.value !== "";
}

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d{1,6}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}
