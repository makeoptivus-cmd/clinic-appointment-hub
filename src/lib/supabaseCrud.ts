
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

type EqFilters = Record<string, string | number | boolean | null>

// Only allow 'appointments' as table name for type safety
type TableName = 'appointments';

export async function createRow<T>(table: TableName, payload: T) {
  const { data, error } = await supabase.from(table).insert(payload as any).select();
  return { data: data as T[] | null, error };
}

export async function readRows<T>(
  table: TableName,
  options?: {
    select?: string;
    eq?: EqFilters;
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  let query = supabase.from(table).select(options?.select ?? '*');

  if (options?.eq) {
    for (const [col, val] of Object.entries(options.eq)) {
      query = query.eq(col, val as any);
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

export async function updateRows<T>(
  table: TableName,
  match: EqFilters,
  changes: Partial<T>
) {
  let query = supabase.from(table).update(changes as any);
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val as any);
  }
  const { data, error } = await query.select();
  return { data: data as T[] | null, error };
}

export async function deleteRows(table: TableName, match: EqFilters) {
  let query = supabase.from(table).delete();
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val as any);
  }
  const { data, error } = await query;
  return { data, error };
}
