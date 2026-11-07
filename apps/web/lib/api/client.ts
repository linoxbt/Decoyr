export const API_BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  referenceId?: string;
  constructor(message: string, status: number, referenceId?: string) {
    super(message);
    this.status = status;
    this.referenceId = referenceId;
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: { Accept: "application/json", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Cannot reach the Decoyr control plane. Check that the API is running.", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    let referenceId: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join("; ");
      referenceId = body?.referenceId;
    } catch {
      /* non-JSON */
    }
    throw new ApiError(detail, res.status, referenceId);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
