PRAGMA foreign_keys = ON;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  source_number INTEGER NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE,
  name_th TEXT NOT NULL,
  label_my TEXT NOT NULL DEFAULT '',
  stock_unit TEXT NOT NULL DEFAULT 'หน่วย',
  purchase_unit TEXT NOT NULL DEFAULT 'ถุง',
  recommended_bags REAL,
  items_per_bag REAL,
  has_stock_field INTEGER NOT NULL DEFAULT 1 CHECK (has_stock_field IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE daily_reports (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  report_date TEXT NOT NULL,
  next_date TEXT NOT NULL,
  order_status TEXT NOT NULL CHECK (order_status IN ('ORDER', 'NO_ORDER')),
  recorder_name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (report_date, next_date)
);

CREATE TABLE inventory_lines (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  remaining_quantity REAL CHECK (remaining_quantity IS NULL OR remaining_quantity >= 0),
  order_quantity REAL CHECK (order_quantity IS NULL OR order_quantity >= 0),
  stock_unit_snapshot TEXT NOT NULL,
  purchase_unit_snapshot TEXT NOT NULL,
  recommended_bags_snapshot REAL,
  items_per_bag_snapshot REAL,
  product_name_th_snapshot TEXT NOT NULL,
  product_label_my_snapshot TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (report_id, product_id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE mcp_events (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  action_result TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_daily_reports_date ON daily_reports(report_date DESC, next_date DESC);
CREATE INDEX idx_daily_reports_status ON daily_reports(order_status, report_date DESC);
CREATE INDEX idx_inventory_lines_product ON inventory_lines(product_id, report_id);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_mcp_events_actor ON mcp_events(actor_email, created_at DESC);

INSERT INTO products (id, source_number, sort_order, name_th, label_my, stock_unit, purchase_unit, has_stock_field) VALUES
('product-01', 1, 1, 'พรชัยลูกชิ้นกลาง', 'မှိုထမဒါအိတ်အနီ', 'ไม้', 'ถุง', 1),
('product-02', 2, 2, 'เม็ดเบทาโกไส้กรอก', 'ဆိုဒ်ကောဒယ်', 'ไม้', 'ถุง', 1),
('product-03', 3, 3, 'ไก่ยอพริก', 'အစပ်အပြားအနီ၃ပြား', 'ไม้', 'ถุง', 1),
('product-04', 4, 4, 'นมวานิลา (ไส้กรอกนม)', 'အပန်းရောင်စံပယ်အနံ့', 'ไม้', 'ถุง', 1),
('product-05', 5, 5, 'จัมโบ้ทอง (ไส้กรอกใหญ่)', 'ဆီုဒ်ကောယိုင်၁၀ဘတ်တန်', 'ไม้', 'ถุง', 1),
('product-06', 6, 6, 'หมูอร่อย', 'မှိုမိတ်ချိ', 'ไม้', 'ถุง', 1),
('product-07', 7, 7, 'ลูกชิ้นแฟนซีจัมโบ้', 'ကိုင်၃လုံး(၁၀ဘတ်တန်)', 'ไม้', 'ถุง', 1),
('product-08', 8, 8, 'เต้าหู้ปลากุนซือ', 'တဟူးလေးထောင့်', 'ไม้', 'ถุง', 1),
('product-09', 9, 9, 'ไก่อร่อย (ไส้กรอกไก่หนังกรอบ)', 'ကိုင်လောင်ကော်', 'ไม้', 'ถุง', 1),
('product-10', 10, 10, 'ชีสเขียว', 'ချိခရုံ', 'ไม้', 'ถุง', 1),
('product-12', 12, 11, 'ลูกชิ้นหมึก (ลูกชิ้นปลาหมึกผสมไก่)', 'လုချင်းပါမူး', 'ไม้', 'ถุง', 1),
('product-13', 13, 12, 'จ๊อปู', 'ကျော့ပူး', 'ไม้', 'ถุง', 1),
('product-14', 14, 13, 'เมก้าแคลป (ปูอัด)', 'ပူးအား(10ဘတ်)', 'ไม้', 'ถุง', 1),
('product-15', 15, 14, 'จ๊อปูอัด', 'ကျော့ပူအာ', 'ไม้', 'ถุง', 1),
('product-16', 16, 15, 'โบราณ (ไก่กรอกแฟรงก์รมควันชีส)', 'ချိလောင်ကော်', 'ไม้', 'ถุง', 1),
('product-17', 17, 16, 'เจเจ (เต้าหู้หมู)', 'တဟူးမှို', 'ไม้', 'ถุง', 1),
('product-18', 18, 17, 'จัมโบ้ทองชีส', 'ကျန်ဘို့ချိစ်(10ဘတ်)', 'ไม้', 'ถุง', 1),
('product-19', 19, 18, 'ปลาทะเลแหลม', 'ပါလန်လုချင်းပါးအဖြူ', 'ไม้', 'ถุง', 1),
('product-20', 20, 19, 'พรชัยเอ็นลูกเล็ก', 'အစ်မှိုအိတ်အပြာ', 'ไม้', 'ถุง', 1),
('product-21', 21, 20, 'ไก่พันสาหร่าย', 'ဖန်စလိုင်', 'ไม้', 'ถุง', 1),
('product-22', 22, 21, 'ปูอัดคนิจังสีเขียว', 'ပူအားလစ်', 'ไม้', 'ถุง', 1),
('product-23', 23, 22, 'เกี๊ยว', 'ကီယုံး(10ဘတ်)', 'ถุง', 'ถุง', 0),
('product-26', 26, 23, 'น้ำจิ้มจอมยุทธ', 'အချဥ်ရည်', 'กล่อง', 'กล่อง', 1);
