export interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const result = await response.json().catch(() => null) as ApiResult<T> | null;
    if (!response.ok || !result?.success) {
      const message = result?.error?.message ?? `เชื่อมต่อระบบไม่สำเร็จ (${response.status})`;
      throw new ApiError(response.status, result?.error?.code ?? "REQUEST_FAILED", message);
    }
    return result.data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(0, "REQUEST_TIMEOUT", "ระบบตอบกลับช้าเกินไป กรุณาตรวจอินเทอร์เน็ตแล้วลองโหลดหน้าใหม่");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function bangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

export function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function formatThaiDate(date: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T12:00:00+07:00`));
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);
}
