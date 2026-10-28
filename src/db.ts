import type {
  AdminIdentity,
  DailyReportDetail,
  DailyReportInput,
  DailyReportSummary,
  Product,
} from "./types";
import type { ProductPayload } from "./schemas";

interface ProductRow {
  id: string;
  sourceNumber: number;
  sortOrder: number;
  nameTh: string;
  labelMy: string;
  stockUnit: string;
  purchaseUnit: string;
  recommendedBags: number | null;
  itemsPerBag: number | null;
  hasStockField: number;
  isActive: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ReportRow {
  id: string;
  reportDate: string;
  nextDate: string;
  orderStatus: "ORDER" | "NO_ORDER";
  recorderName: string;
  createdBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  orderBagCount: number;
}

interface ReportLineRow {
  id: string;
  productId: string;
  remainingQuantity: number | null;
  orderQuantity: number | null;
  productNameTh: string;
  productLabelMy: string;
  stockUnit: string;
  purchaseUnit: string;
  recommendedBags: number | null;
  itemsPerBag: number | null;
}

function productFromRow(row: ProductRow): Product {
  return {
    ...row,
    hasStockField: row.hasStockField === 1,
    isActive: row.isActive === 1,
  };
}

function auditStatement(
  db: D1Database,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
) {
  return db.prepare(
    `INSERT INTO audit_events (id, actor_email, action, entity_type, entity_id, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), actor, action, entityType, entityId, JSON.stringify(details));
}

async function productsById(db: D1Database): Promise<Map<string, Product>> {
  const result = await db.prepare(
    `SELECT id, source_number AS sourceNumber, sort_order AS sortOrder,
            name_th AS nameTh, label_my AS labelMy, stock_unit AS stockUnit,
            purchase_unit AS purchaseUnit, recommended_bags AS recommendedBags,
            items_per_bag AS itemsPerBag, has_stock_field AS hasStockField,
            is_active AS isActive, version, created_at AS createdAt,
            updated_at AS updatedAt
       FROM products`,
  ).all<ProductRow>();
  return new Map(result.results.map((row) => [row.id, productFromRow(row)]));
}

function reportLineStatements(
  db: D1Database,
  reportId: string,
  lines: DailyReportInput["lines"],
  products: Map<string, Product>,
  expectedVersion?: number,
  priorLines?: Map<string, Pick<ReportLineRow, "stockUnit" | "purchaseUnit" | "recommendedBags" | "itemsPerBag" | "productNameTh" | "productLabelMy">>,
) {
  return lines.map((line) => {
    const product = products.get(line.productId);
    if (!product) throw new Error(`ไม่พบสินค้า ${line.productId}`);
    const snapshot = priorLines?.get(product.id) ?? {
      stockUnit: product.stockUnit,
      purchaseUnit: product.purchaseUnit,
      recommendedBags: product.recommendedBags,
      itemsPerBag: product.itemsPerBag,
      productNameTh: product.nameTh,
      productLabelMy: product.labelMy,
    };
    const values = [
      crypto.randomUUID(), reportId, product.id, line.remainingQuantity, line.orderQuantity,
      snapshot.stockUnit, snapshot.purchaseUnit, snapshot.recommendedBags, snapshot.itemsPerBag,
      snapshot.productNameTh, snapshot.productLabelMy,
    ];
    if (expectedVersion === undefined) {
      return db.prepare(
        `INSERT INTO inventory_lines
          (id, report_id, product_id, remaining_quantity, order_quantity,
           stock_unit_snapshot, purchase_unit_snapshot, recommended_bags_snapshot,
           items_per_bag_snapshot, product_name_th_snapshot, product_label_my_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(...values);
    }
    return db.prepare(
      `INSERT INTO inventory_lines
        (id, report_id, product_id, remaining_quantity, order_quantity,
         stock_unit_snapshot, purchase_unit_snapshot, recommended_bags_snapshot,
         items_per_bag_snapshot, product_name_th_snapshot, product_label_my_snapshot)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM daily_reports WHERE id = ? AND version = ?)`,
    ).bind(...values, reportId, expectedVersion);
  });
}

export async function listProducts(db: D1Database, includeInactive = false): Promise<Product[]> {
  const result = await db.prepare(
    `SELECT id, source_number AS sourceNumber, sort_order AS sortOrder,
            name_th AS nameTh, label_my AS labelMy, stock_unit AS stockUnit,
            purchase_unit AS purchaseUnit, recommended_bags AS recommendedBags,
            items_per_bag AS itemsPerBag, has_stock_field AS hasStockField,
            is_active AS isActive, version, created_at AS createdAt,
            updated_at AS updatedAt
       FROM products
      WHERE (? = 1 OR is_active = 1)
      ORDER BY sort_order ASC, name_th ASC`,
  ).bind(includeInactive ? 1 : 0).all<ProductRow>();
  return result.results.map(productFromRow);
}

export async function createProduct(db: D1Database, actor: AdminIdentity, input: ProductPayload): Promise<Product> {
  const next = await db.prepare(
    `SELECT COALESCE(MAX(source_number), 0) + 1 AS sourceNumber,
            COALESCE(MAX(sort_order), 0) + 1 AS sortOrder FROM products`,
  ).first<{ sourceNumber: number; sortOrder: number }>();
  const sourceNumber = input.sourceNumber ?? next?.sourceNumber ?? 1;
  const sortOrder = next?.sortOrder ?? 1;
  const id = crypto.randomUUID();
  const statements = [
    db.prepare(
      `INSERT INTO products
        (id, source_number, sort_order, name_th, label_my, stock_unit, purchase_unit,
         recommended_bags, items_per_bag, has_stock_field, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, sourceNumber, sortOrder, input.nameTh, input.labelMy, input.stockUnit,
      input.purchaseUnit, input.recommendedBags, input.itemsPerBag,
      input.hasStockField ? 1 : 0, input.isActive ? 1 : 0),
    auditStatement(db, actor.email, "CREATE", "product", id, { sourceNumber }),
  ];
  await db.batch(statements);
  const created = (await listProducts(db, true)).find((product) => product.id === id);
  if (!created) throw new Error("สร้างสินค้าไม่สำเร็จ");
  return created;
}

export async function updateProduct(
  db: D1Database,
  actor: AdminIdentity,
  id: string,
  input: ProductPayload & { version: number },
): Promise<Product> {
  const nextVersion = input.version + 1;
  const update = db.prepare(
    `UPDATE products SET
       name_th = ?, label_my = ?, stock_unit = ?, purchase_unit = ?,
       recommended_bags = ?, items_per_bag = ?, has_stock_field = ?, is_active = ?,
       version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND version = ?`,
  ).bind(input.nameTh, input.labelMy, input.stockUnit, input.purchaseUnit,
    input.recommendedBags, input.itemsPerBag, input.hasStockField ? 1 : 0,
    input.isActive ? 1 : 0, id, input.version);
  const audit = db.prepare(
    `INSERT INTO audit_events (id, actor_email, action, entity_type, entity_id, details_json)
     SELECT ?, ?, 'UPDATE', 'product', ?, ?
     WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ?)`,
  ).bind(crypto.randomUUID(), actor.email, id,
    JSON.stringify({ values: input }),
    id, nextVersion);
  const [updated] = await db.batch([update, audit]);
  if ((updated?.meta.changes ?? 0) === 0) {
    const exists = await db.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
    if (!exists) throw new Error("ไม่พบสินค้า");
    throw new Error("ข้อมูลสินค้าถูกแก้ไขจากที่อื่นแล้ว กรุณาโหลดใหม่");
  }
  const product = (await listProducts(db, true)).find((item) => item.id === id);
  if (!product) throw new Error("ไม่พบสินค้าหลังบันทึก");
  return product;
}

export async function listReports(
  db: D1Database,
  options: { from?: string; to?: string; status?: string; limit?: number; offset?: number } = {},
): Promise<DailyReportSummary[]> {
  const result = await db.prepare(
    `SELECT r.id, r.report_date AS reportDate, r.next_date AS nextDate,
            r.order_status AS orderStatus, r.recorder_name AS recorderName,
            r.created_by AS createdBy, r.version, r.created_at AS createdAt,
            r.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM inventory_lines l WHERE l.report_id = r.id) AS lineCount,
            COALESCE((SELECT SUM(l.order_quantity) FROM inventory_lines l WHERE l.report_id = r.id), 0) AS orderBagCount
       FROM daily_reports r
      WHERE (? IS NULL OR r.report_date >= ?)
        AND (? IS NULL OR r.report_date <= ?)
        AND (? IS NULL OR r.order_status = ?)
      ORDER BY r.report_date DESC, r.created_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(options.from ?? null, options.from ?? null,
    options.to ?? null, options.to ?? null,
    options.status ?? null, options.status ?? null,
    Math.min(Math.max(options.limit ?? 100, 1), 150), Math.max(options.offset ?? 0, 0))
    .all<ReportRow>();
  return result.results;
}

export async function getReport(db: D1Database, id: string): Promise<DailyReportDetail | null> {
  const report = await db.prepare(
    `SELECT r.id, r.report_date AS reportDate, r.next_date AS nextDate,
            r.order_status AS orderStatus, r.recorder_name AS recorderName,
            r.created_by AS createdBy, r.version, r.created_at AS createdAt,
            r.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM inventory_lines l WHERE l.report_id = r.id) AS lineCount,
            COALESCE((SELECT SUM(l.order_quantity) FROM inventory_lines l WHERE l.report_id = r.id), 0) AS orderBagCount
       FROM daily_reports r WHERE r.id = ?`,
  ).bind(id).first<ReportRow>();
  if (!report) return null;
  const result = await db.prepare(
    `SELECT id, product_id AS productId, remaining_quantity AS remainingQuantity,
            order_quantity AS orderQuantity, product_name_th_snapshot AS productNameTh,
            product_label_my_snapshot AS productLabelMy, stock_unit_snapshot AS stockUnit,
            purchase_unit_snapshot AS purchaseUnit, recommended_bags_snapshot AS recommendedBags,
            items_per_bag_snapshot AS itemsPerBag
       FROM inventory_lines WHERE report_id = ? ORDER BY product_id ASC`,
  ).bind(id).all<ReportLineRow>();
  return { ...report, lines: result.results };
}

export async function createReport(db: D1Database, actor: AdminIdentity, input: DailyReportInput, idempotencyKey: string = crypto.randomUUID()): Promise<DailyReportDetail> {
  const prior = await db.prepare("SELECT id FROM daily_reports WHERE idempotency_key = ?").bind(idempotencyKey).first<{ id: string }>();
  if (prior) {
    const report = await getReport(db, prior.id);
    if (report) return report;
  }
  const id = crypto.randomUUID();
  const products = await productsById(db);
  const missing = input.lines.filter((line) => !products.has(line.productId));
  if (missing.length) throw new Error(`ไม่พบสินค้าในรายการ ${missing.map((line) => line.productId).join(", ")}`);
  const lineStatements = reportLineStatements(db, id, input.lines, products);
  const statements = [
    db.prepare(
      `INSERT INTO daily_reports (id, idempotency_key, report_date, next_date, order_status, recorder_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, idempotencyKey, input.reportDate, input.nextDate, input.orderStatus, input.recorderName, actor.email),
    ...lineStatements,
    auditStatement(db, actor.email, "CREATE", "daily_report", id, {
      reportDate: input.reportDate,
      nextDate: input.nextDate,
      orderStatus: input.orderStatus,
      lineCount: input.lines.length,
      lines: input.lines,
    }),
  ];
  await db.batch(statements);
  const created = await getReport(db, id);
  if (!created) throw new Error("บันทึกรายงานไม่สำเร็จ");
  return created;
}

export async function updateReport(
  db: D1Database,
  actor: AdminIdentity,
  id: string,
  input: DailyReportInput & { version: number },
): Promise<DailyReportDetail> {
  const existing = await getReport(db, id);
  if (!existing) throw new Error("ไม่พบรายงาน");
  const products = await productsById(db);
  const missing = input.lines.filter((line) => !products.has(line.productId));
  if (missing.length) throw new Error(`ไม่พบสินค้าในรายการ ${missing.map((line) => line.productId).join(", ")}`);
  const nextVersion = input.version + 1;
  const update = db.prepare(
    `UPDATE daily_reports SET report_date = ?, next_date = ?, order_status = ?,
       recorder_name = ?, version = version + 1,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND version = ?`,
  ).bind(input.reportDate, input.nextDate, input.orderStatus, input.recorderName, id, input.version);
  const deleteLines = db.prepare(
    `DELETE FROM inventory_lines WHERE report_id = ?
      AND EXISTS (SELECT 1 FROM daily_reports WHERE id = ? AND version = ?)`,
  ).bind(id, id, nextVersion);
  const priorLines = new Map(existing.lines.map((line) => [line.productId, line]));
  const lineStatements = reportLineStatements(db, id, input.lines, products, nextVersion, priorLines);
  const audit = db.prepare(
    `INSERT INTO audit_events (id, actor_email, action, entity_type, entity_id, details_json)
     SELECT ?, ?, 'UPDATE', 'daily_report', ?, ?
     WHERE EXISTS (SELECT 1 FROM daily_reports WHERE id = ? AND version = ?)`,
  ).bind(crypto.randomUUID(), actor.email, id,
    JSON.stringify({ reportDate: input.reportDate, nextDate: input.nextDate, orderStatus: input.orderStatus, recorderName: input.recorderName, lines: input.lines }),
    id, nextVersion);
  const [updated] = await db.batch([update, deleteLines, ...lineStatements, audit]);
  if ((updated?.meta.changes ?? 0) === 0) {
    const exists = await db.prepare("SELECT id FROM daily_reports WHERE id = ?").bind(id).first();
    if (!exists) throw new Error("ไม่พบรายงาน");
    throw new Error("รายงานถูกแก้ไขจากที่อื่นแล้ว กรุณาโหลดใหม่");
  }
  const report = await getReport(db, id);
  if (!report) throw new Error("ไม่พบรายงานหลังบันทึก");
  return report;
}

export async function dashboardSummary(db: D1Database) {
  const [productCounts, reportCounts, latest] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM products`).first<{ total: number; active: number }>(),
    db.prepare(`SELECT COUNT(*) AS total FROM daily_reports`).first<{ total: number }>(),
    db.prepare(`SELECT id, report_date AS reportDate, next_date AS nextDate,
                       order_status AS orderStatus, recorder_name AS recorderName,
                       created_by AS createdBy, version, created_at AS createdAt,
                       updated_at AS updatedAt, 0 AS lineCount, 0 AS orderBagCount
                  FROM daily_reports ORDER BY report_date DESC, created_at DESC LIMIT 1`).first<ReportRow>(),
  ]);
  return {
    productCount: productCounts?.total ?? 0,
    activeProductCount: productCounts?.active ?? 0,
    reportCount: reportCounts?.total ?? 0,
    latestReport: latest ?? null,
  };
}

export async function currentInventory(db: D1Database) {
  const result = await db.prepare(
    `SELECT p.id AS productId, p.source_number AS sourceNumber, p.name_th AS nameTh,
            p.label_my AS labelMy, p.stock_unit AS stockUnit,
            p.purchase_unit AS purchaseUnit, p.recommended_bags AS recommendedBags,
            p.items_per_bag AS itemsPerBag, p.has_stock_field AS hasStockField,
            l.remaining_quantity AS remainingQuantity, l.order_quantity AS orderQuantity,
            r.report_date AS reportDate, r.next_date AS nextDate
       FROM products p
       LEFT JOIN daily_reports r ON r.id = (
         SELECT id FROM daily_reports ORDER BY report_date DESC, created_at DESC LIMIT 1
       )
       LEFT JOIN inventory_lines l ON l.product_id = p.id AND l.report_id = r.id
      WHERE p.is_active = 1
      ORDER BY p.sort_order ASC`,
  ).all();
  return result.results;
}

export async function logMcpEvent(
  db: D1Database,
  actor: string,
  toolName: string,
  result: "SUCCESS" | "ERROR",
  entityId?: string,
) {
  await db.prepare(
    `INSERT INTO mcp_events (id, actor_email, tool_name, action_result, entity_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), actor, toolName, result, entityId ?? null).run();
}
