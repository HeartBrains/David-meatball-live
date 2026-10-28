import { Hono } from "hono";
import { requireAdmin } from "./auth";
import { createProduct, createReport, currentInventory, dashboardSummary, getReport, listProducts, listReports, updateProduct, updateReport } from "./db";
import { createAdminMcpHandler } from "./mcp";
import { productSchema, reportSchema, updateProductSchema, updateReportSchema } from "./schemas";
import type { AdminIdentity, Env } from "./types";

type Variables = { admin: AdminIdentity };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/health", (c) => c.json({ service: "David Meatball Live", status: "ok" }));

app.use("*", requireAdmin);
app.use("/api/*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "no-store, private");
  c.res.headers.set("X-Content-Type-Options", "nosniff");
});

app.get("/api/session", (c) => c.json({ success: true, data: { email: c.get("admin").email } }));

app.get("/api/dashboard", async (c) => c.json({ success: true, data: await dashboardSummary(c.env.DB) }));
app.get("/api/inventory/current", async (c) => c.json({ success: true, data: await currentInventory(c.env.DB) }));

app.get("/api/products", async (c) => {
  const includeInactive = c.req.query("all") === "true";
  return c.json({ success: true, data: await listProducts(c.env.DB, includeInactive) });
});

app.post("/api/products", async (c) => {
  const parsed = productSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: { code: "INVALID_INPUT", message: "ตรวจสอบข้อมูลสินค้าอีกครั้ง" } }, 400);
  const product = await createProduct(c.env.DB, c.get("admin"), parsed.data);
  return c.json({ success: true, data: product }, 201);
});

app.patch("/api/products/:id", async (c) => {
  const parsed = updateProductSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: { code: "INVALID_INPUT", message: "ตรวจสอบข้อมูลสินค้าอีกครั้ง" } }, 400);
  const product = await updateProduct(c.env.DB, c.get("admin"), c.req.param("id"), parsed.data);
  return c.json({ success: true, data: product });
});

app.get("/api/reports", async (c) => {
  const status = c.req.query("status");
  if (status && status !== "ORDER" && status !== "NO_ORDER") {
    return c.json({ success: false, error: { code: "INVALID_INPUT", message: "สถานะรายงานไม่ถูกต้อง" } }, 400);
  }
  const limit = Number(c.req.query("limit") ?? 100);
  const offset = Number(c.req.query("offset") ?? 0);
  const data = await listReports(c.env.DB, {
    from: c.req.query("from"),
    to: c.req.query("to"),
    status: status ?? undefined,
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  return c.json({ success: true, count: data.length, data });
});

app.get("/api/reports/:id", async (c) => {
  const report = await getReport(c.env.DB, c.req.param("id"));
  if (!report) return c.json({ success: false, error: { code: "NOT_FOUND", message: "ไม่พบรายงานนี้" } }, 404);
  return c.json({ success: true, data: report });
});

app.post("/api/reports", async (c) => {
  const parsed = reportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: { code: "INVALID_INPUT", message: "ตรวจสอบวันที่ ชื่อผู้บันทึก และข้อมูลสินค้า" } }, 400);
  const report = await createReport(c.env.DB, c.get("admin"), parsed.data, c.req.header("Idempotency-Key") ?? crypto.randomUUID());
  return c.json({ success: true, data: report }, 201);
});

app.patch("/api/reports/:id", async (c) => {
  const parsed = updateReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: { code: "INVALID_INPUT", message: "ตรวจสอบข้อมูลรายงานอีกครั้ง" } }, 400);
  const report = await updateReport(c.env.DB, c.get("admin"), c.req.param("id"), parsed.data);
  return c.json({ success: true, data: report });
});

app.post("/api/reports/:id/submit", async (c) => {
  const parsed = updateReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: { code: "INVALID_INPUT", message: "ตรวจสอบข้อมูลรายงานอีกครั้ง" } }, 400);
  const report = await updateReport(c.env.DB, c.get("admin"), c.req.param("id"), parsed.data);
  return c.json({ success: true, data: report });
});

app.get("/api/products/:id/history", async (c) => {
  const reports = await listReports(c.env.DB, { limit: 150 });
  const history = [];
  for (const report of reports) {
    const detail = await getReport(c.env.DB, report.id);
    const line = detail?.lines.find((item) => item.productId === c.req.param("id"));
    if (line) history.push({ ...report, line });
  }
  return c.json({ success: true, data: history });
});

app.get("/api/orders", async (c) => {
  const reports = await listReports(c.env.DB, {
    from: c.req.query("from"),
    to: c.req.query("to"),
    status: "ORDER",
    limit: 150,
  });
  return c.json({ success: true, count: reports.length, data: reports });
});

app.get("/api/orders/:id", async (c) => {
  const report = await getReport(c.env.DB, c.req.param("id"));
  if (!report || report.orderStatus !== "ORDER") {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "ไม่พบรายการสั่งของนี้" } }, 404);
  }
  return c.json({ success: true, data: report });
});

app.get("/api/export.csv", async (c) => {
  const reports = await listReports(c.env.DB, {
    from: c.req.query("from"),
    to: c.req.query("to"),
    status: c.req.query("status"),
    limit: 150,
  });
  const rows = [["วันที่บันทึก", "วันต่อไป", "ชื่อผู้บันทึก", "สถานะสั่งของ", "สินค้า", "ยอดคงเหลือ", "หน่วยคงเหลือ", "จำนวนสั่ง", "หน่วยสั่ง"]];
  for (const report of reports) {
    const detail = await getReport(c.env.DB, report.id);
    for (const line of detail?.lines ?? []) {
      rows.push([
        report.reportDate,
        report.nextDate,
        report.recorderName,
        report.orderStatus === "ORDER" ? "สั่งของ" : "ไม่สั่งของ",
        line.productNameTh,
        line.remainingQuantity === null ? "" : String(line.remainingQuantity),
        line.stockUnit,
        line.orderQuantity === null ? "" : String(line.orderQuantity),
        line.purchaseUnit,
      ]);
    }
  }
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="david-meatball-reports.csv"`,
      "Cache-Control": "no-store, private",
    },
  });
});

app.all("/mcp", async (c) => {
  if (c.env.MCP_ENABLED !== "true") {
    return c.json({ success: false, error: { code: "MCP_DISABLED", message: "MCP ยังไม่ได้เปิดใช้งาน" } }, 404);
  }
  const handler = createAdminMcpHandler(c.env, c.get("admin"));
  return handler.fetch(c.req.raw);
});

app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((error, c) => {
  const message = error.message ?? "";
  if (message.includes("UNIQUE constraint failed")) {
    return c.json({ success: false, error: { code: "DUPLICATE_RECORD", message: "ข้อมูลซ้ำหรือมีรายงานวันดังกล่าวแล้ว กรุณาตรวจรายการเดิม" } }, 409);
  }
  if (message.includes("ไม่พบ")) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message } }, 404);
  }
  if (message.includes("ถูกแก้ไขจากที่อื่น")) {
    return c.json({ success: false, error: { code: "EDIT_CONFLICT", message } }, 409);
  }
  console.error("request failed", { path: c.req.path, error });
  return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่" } }, 500);
});

function csvCell(value: string) {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export default app;
