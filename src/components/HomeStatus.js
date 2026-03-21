export default function HomeStatus({ horses }) {
  const now = Date.now();
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;

  // Any horse counts as "updated" if it has updatedAt, otherwise fallback to createdAt.
  const updates = (horses || [])
    .map((h) => {
      const ts = h.updatedAt || h.createdAt || 0;
      return { horse: h, ts };
    })
    .filter((x) => x.ts);

  const updatesLastDay = updates.filter((x) => now - x.ts <= DAY);
  const updatesLastFiveDays = updates.filter((x) => now - x.ts <= FIVE_DAYS);

  let statusLine = "No notable updates for your horses in the last 5 days.";

  if (updatesLastDay.length > 0) {
    statusLine = `${updatesLastDay.length} notable update${updatesLastDay.length === 1 ? "" : "s"} in the last 24 hours.`;
  } else if (updatesLastFiveDays.length > 0) {
    statusLine = `Updates logged for ${updatesLastFiveDays.length} horse${updatesLastFiveDays.length === 1 ? "" : "s"} in the last 5 days.`;
  }

  // Show up to 2 most recent updates (only when there are updates in last 5 days)
  const recent = updatesLastFiveDays
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 2);

  return (
    <div style={{ marginTop: 14, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Status</div>
      <div style={{ fontSize: 14, opacity: 0.9 }}>{statusLine}</div>

      {recent.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {recent.map(({ horse, ts }) => (
            <div key={horse.id} style={{ fontSize: 14, marginTop: 6 }}>
              <strong>{horse.name || "Unnamed"}</strong> — profile updated (
              {new Date(ts).toLocaleString()})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}