import { createServiceClient } from '@/lib/supabase/server';

/**
 * Find and update a task by ID, supporting both full 36-char UUIDs and
 * short 8-char prefixes. When a short prefix is supplied, the lookup uses
 * a `starts_with` match against the ID cast to text — this prevents the
 * gate failure that occurred on 2026-06-01 when Hermes truncated the task
 * UUID to 8 chars.
 *
 * Returns the matched row (via `.maybeSingle()`), or null / error.
 */
export async function updateTaskByPrefix(
  id: string,
  updates: Record<string, unknown>,
  extraEq?: Record<string, unknown>,
) {
  const supabase = createServiceClient();

  // Build a base query
  let query = supabase.from('tasks').update(updates);

  // --- Resolve the ID filter ---
  if (id.length >= 36) {
    // Full UUID — exact match
    query = query.eq('id', id);
  } else {
    // Short prefix — match via UUID range comparison.
    // UUID columns don't support LIKE, but they do support >= and <=.
    // By forming a lower/upper bound with the prefix, we get a clean
    // starts-with match without type casting tricks.
    const lowerBound = `${id}-00000000-0000-0000-000000000000`;
    const upperBound = `${id}-ffffffff-ffff-ffff-ffffffffffff`;
    query = query.gte('id', lowerBound).lte('id', upperBound);
  }

  // Apply equality filters (e.g. claimed_by, status)
  if (extraEq) {
    for (const [key, value] of Object.entries(extraEq)) {
      if (value === null) {
        query = query.is(key, null);
      } else {
        query = query.eq(key, value);
      }
    }
  }

  const { data, error } = await query.select().maybeSingle();
  return { data, error };
}
