const warned = new Set<string>();

/** Logs a warning once per key. Quartz renders every page, so unguarded warnings flood the log. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[forms] ${message}`);
}

/** Test helper: forget which warnings were already emitted. */
export function resetWarnings(): void {
  warned.clear();
}
