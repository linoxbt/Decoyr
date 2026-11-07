const warmCache = new Map<string, number>();

export function warmTenantIndex(tenantId: string) {
  if (warmCache.has(tenantId)) return warmCache.get(tenantId)!;
  const builtAt = Date.now();
  warmCache.set(tenantId, builtAt);
  return builtAt;
}
