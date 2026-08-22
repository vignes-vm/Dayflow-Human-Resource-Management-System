function flatten(obj: unknown, prefix = ""): Record<string, string> {
  if (obj === null || obj === undefined) return {};
  if (typeof obj !== "object") return { [prefix || "value"]: String(obj) };

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = Array.isArray(value) ? JSON.stringify(value) : String(value);
    }
  }
  return out;
}

/** Readable before → after diff, per Dayflow-Blueprint-v2.md §11 (S20) — never raw JSON. */
export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const beforeFlat = flatten(before);
  const afterFlat = flatten(after);
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]));

  if (keys.length === 0) {
    return <p className="text-ink-500 text-sm">No field-level detail recorded for this entry.</p>;
  }

  return (
    <div className="rounded-card border-border overflow-x-auto border">
      <table className="w-full text-sm">
        <thead className="bg-ink-100/60 text-ink-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">Field</th>
            <th className="px-3 py-2 text-left">Before</th>
            <th className="px-3 py-2 text-left">After</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const changed = beforeFlat[key] !== afterFlat[key];
            return (
              <tr key={key} className="border-border border-t">
                <td className="text-ink-700 px-3 py-2 font-medium">{key}</td>
                <td
                  className={`tabular px-3 py-2 font-mono ${changed ? "text-danger line-through" : "text-ink-500"}`}
                >
                  {beforeFlat[key] ?? "—"}
                </td>
                <td
                  className={`tabular px-3 py-2 font-mono ${changed ? "text-present font-medium" : "text-ink-500"}`}
                >
                  {afterFlat[key] ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
