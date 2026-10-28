import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { createProduct, createReport, getReport, listProducts, listReports, logMcpEvent, updateReport, updateProduct } from "./db";
import { productSchema, reportSchema, updateProductSchema } from "./schemas";
import type { AdminIdentity, Env } from "./types";

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }],
  };
}

export function createAdminMcpHandler(env: Env, actor: AdminIdentity) {
  return createMcpHandler(() => {
    const server = new McpServer({ name: "david-meatball-live", version: "0.1.0" });

    server.registerTool("list_products", {
      description: "แสดงรายการสินค้าและข้อมูลบรรจุภัณฑ์ที่ตั้งไว้",
      inputSchema: z.object({ includeInactive: z.boolean().optional() }),
    }, async ({ includeInactive }) => {
      try {
        const products = await listProducts(env.DB, includeInactive ?? false);
        await logMcpEvent(env.DB, actor.email, "list_products", "SUCCESS");
        return textResult(products);
      } catch (error) {
        await logMcpEvent(env.DB, actor.email, "list_products", "ERROR");
        return errorResult(error);
      }
    });

    server.registerTool("list_daily_reports", {
      description: "ค้นหารายงานสต็อกตามช่วงวันและสถานะสั่งของ",
      inputSchema: z.object({
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        status: z.enum(["ORDER", "NO_ORDER"]).optional(),
        limit: z.number().int().min(1).max(150).optional(),
      }),
    }, async (input) => {
      try {
        const reports = await listReports(env.DB, input);
        await logMcpEvent(env.DB, actor.email, "list_daily_reports", "SUCCESS");
        return textResult(reports);
      } catch (error) {
        await logMcpEvent(env.DB, actor.email, "list_daily_reports", "ERROR");
        return errorResult(error);
      }
    });

    server.registerTool("get_daily_report", {
      description: "ดูรายงานสต็อกและจำนวนสั่งของตามรหัสรายงาน",
      inputSchema: z.object({ id: z.string().min(1).max(80) }),
    }, async ({ id }) => {
      try {
        const report = await getReport(env.DB, id);
        await logMcpEvent(env.DB, actor.email, "get_daily_report", "SUCCESS", id);
        return textResult(report ?? { found: false });
      } catch (error) {
        await logMcpEvent(env.DB, actor.email, "get_daily_report", "ERROR", id);
        return errorResult(error);
      }
    });

    server.registerTool("create_daily_report", {
      description: "สร้างรายงานสต็อก โดยแอดมินระบุจำนวนคงเหลือและจำนวนสั่งเอง",
      inputSchema: reportSchema,
    }, async (input) => {
      try {
        const parsed = reportSchema.parse(input);
        const report = await createReport(env.DB, actor, parsed, `mcp:${crypto.randomUUID()}`);
        await logMcpEvent(env.DB, actor.email, "create_daily_report", "SUCCESS", report.id);
        return textResult(report);
      } catch (error) {
        await logMcpEvent(env.DB, actor.email, "create_daily_report", "ERROR");
        return errorResult(error);
      }
    });

    server.registerTool("update_daily_report", {
      description: "แก้ไขรายงานสต็อกเดิม โดยส่ง version ล่าสุดกลับมาด้วย",
      inputSchema: reportSchema.extend({ id: z.string().min(1).max(80), version: z.number().int().min(1) }),
    }, async (input) => {
      try {
        const report = await updateReport(env.DB, actor, input.id, input);
        await logMcpEvent(env.DB, actor.email, "update_daily_report", "SUCCESS", input.id);
        return textResult(report);
      } catch (error) {
        await logMcpEvent(env.DB, actor.email, "update_daily_report", "ERROR", input.id);
        return errorResult(error);
      }
    });

    server.registerTool("update_product", {
      description: "แก้ไขชื่อ หน่วย ป้ายภาษาเมียนมา และ metadata บรรจุภัณฑ์ของสินค้า",
      inputSchema: updateProductSchema.extend({ id: z.string().min(1).max(80) }),
    }, async (input) => {
      try {
        const { id, ...values } = input;
        const product = await updateProduct(env.DB, actor, id, values);
        await logMcpEvent(env.DB, actor.email, "update_product", "SUCCESS", id);
        return textResult(product);
      } catch (error) {
        await logMcpEvent(env.DB, actor.email, "update_product", "ERROR", input.id);
        return errorResult(error);
      }
    });

    server.registerTool("create_product", {
      description: "เพิ่มสินค้าใหม่พร้อมหน่วยและ metadata บรรจุภัณฑ์",
      inputSchema: productSchema,
    }, async (input) => {
      try {
        const product = await createProduct(env.DB, actor, productSchema.parse(input));
        await logMcpEvent(env.DB, actor.email, "create_product", "SUCCESS", product.id);
        return textResult(product);
      } catch (error) {
        await logMcpEvent(env.DB, actor.email, "create_product", "ERROR");
        return errorResult(error);
      }
    });

    return server;
  }, { responseMode: "json" });
}
