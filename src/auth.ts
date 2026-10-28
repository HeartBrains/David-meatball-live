import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import type { AdminIdentity, Env } from "./types";

type AppContext = Context<{ Bindings: Env; Variables: { admin: AdminIdentity } }>;

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function remoteKeys(issuer: string) {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer.replace(/\/$/, "")}/cdn-cgi/access/certs`));
    keySets.set(issuer, keys);
  }
  return keys;
}

function allowedAdmins(env: Env): Set<string> {
  return new Set((env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export async function identifyAdmin(request: Request, env: Env): Promise<AdminIdentity | Response> {
  const allowlist = allowedAdmins(env);
  if (allowlist.size === 0) {
    return Response.json({ success: false, error: { code: "ADMIN_AUTH_NOT_CONFIGURED", message: "ยังไม่ได้ตั้งค่าอีเมลผู้ดูแลระบบ" } }, { status: 503 });
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion")
    ?? request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!token && env.ENVIRONMENT === "development" && env.DEV_ADMIN_EMAIL) {
    const email = env.DEV_ADMIN_EMAIL.trim().toLowerCase();
    if (allowlist.has(email)) return { email, subject: "local-development" };
  }

  if (!token) {
    return Response.json({ success: false, error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบผู้ดูแลผ่าน Cloudflare Access" } }, { status: 401 });
  }
  if (!env.CF_ACCESS_ISSUER || !env.CF_ACCESS_AUD) {
    return Response.json({ success: false, error: { code: "ACCESS_NOT_CONFIGURED", message: "ยังไม่ได้ตั้งค่า Cloudflare Access ให้ Worker" } }, { status: 503 });
  }

  try {
    const { payload } = await jwtVerify(token, remoteKeys(env.CF_ACCESS_ISSUER), {
      issuer: env.CF_ACCESS_ISSUER,
      audience: env.CF_ACCESS_AUD,
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || !allowlist.has(email)) {
      return Response.json({ success: false, error: { code: "FORBIDDEN", message: "อีเมลนี้ไม่มีสิทธิ์เป็นผู้ดูแลระบบ" } }, { status: 403 });
    }
    return { email, subject: typeof payload.sub === "string" ? payload.sub : undefined };
  } catch {
    return Response.json({ success: false, error: { code: "INVALID_ACCESS_TOKEN", message: "ยืนยันตัวตนกับ Cloudflare Access ไม่สำเร็จ" } }, { status: 401 });
  }
}

export async function requireAdmin(c: AppContext, next: Next) {
  const identity = await identifyAdmin(c.req.raw, c.env);
  if (identity instanceof Response) return identity;
  c.set("admin", identity);
  await next();
}
