import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type EqFilters = Record<string, string | number | boolean | null>;
type TableName = "appointments";

type AppointmentInsert = Database["public"]["Tables"]["appointments"]["Insert"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];
type ErrorLike = { message: string } | null;
type QueryResult = { data: unknown; error: ErrorLike };

type ReadQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: EqFilters[string]) => ReadQuery;
  order: (column: string, options?: { ascending?: boolean }) => ReadQuery;
  limit: (count: number) => ReadQuery;
};

type UpdateQuery = {
  eq: (column: string, value: EqFilters[string]) => UpdateQuery;
  select: () => Promise<QueryResult>;
};

type DeleteQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: EqFilters[string]) => DeleteQuery;
};

export async function createRow<T extends AppointmentInsert>(table: TableName, payload: T) {
  const { data, error } = await supabase.from(table).insert(payload).select();
  return { data: data as AppointmentRow[] | null, error };
}

export async function readRows<T = AppointmentRow>(
  table: TableName,
  options?: {
    select?: string;
    eq?: EqFilters;
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  let query = supabase.from(table).select(options?.select ?? "*") as unknown as ReadQuery;

  if (options?.eq) {
    for (const [col, val] of Object.entries(options.eq)) {
      query = query.eq(col, val);
    }
  }

  if (options?.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  return { data: data as T[] | null, error };
}

export async function updateRows(table: TableName, match: EqFilters, changes: AppointmentUpdate) {
  let query = supabase.from(table).update(changes) as unknown as UpdateQuery;

  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }

  const { data, error } = await query.select();
  return { data: data as AppointmentRow[] | null, error };
}

export async function deleteRows(table: TableName, match: EqFilters) {
  let query = supabase.from(table).delete() as unknown as DeleteQuery;

  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }

  const { data, error } = await query;
  return { data, error };
}
