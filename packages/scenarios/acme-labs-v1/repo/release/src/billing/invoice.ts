export type UsageLine = { metric: string; quantity: number; unitPriceCents: number };

export function buildInvoice(lines: UsageLine[]) {
  const items = lines.map((l) => ({ ...l, totalCents: l.quantity * l.unitPriceCents }));
  return { items, totalCents: items.reduce((s, i) => s + i.totalCents, 0) };
}
