import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownToLine, ArrowLeft, ArrowUpRight, Boxes, CalendarDays, Check, ChevronRight,
  ClipboardList, FilePlus2, LayoutDashboard, LoaderCircle, Package, Pencil, Plus, RefreshCw,
  ExternalLink, Save, Search, Settings2, ShieldCheck, ShoppingBasket, X,
} from "lucide-react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { addDays, api, bangkokDate, formatNumber, formatThaiDate } from "./api";

interface Product {
  id: string;
  sourceNumber: number;
  sortOrder: number;
  nameTh: string;
  labelMy: string;
  stockUnit: string;
  purchaseUnit: string;
  recommendedBags: number | null;
  itemsPerBag: number | null;
  hasStockField: boolean;
  isActive: boolean;
  version: number;
}

interface ReportLine {
  id?: string;
  productId: string;
  remainingQuantity: number | null;
  orderQuantity: number | null;
  productNameTh?: string;
  productLabelMy?: string;
  stockUnit?: string;
  purchaseUnit?: string;
  recommendedBags?: number | null;
  itemsPerBag?: number | null;
}

interface ReportSummary {
  id: string;
  reportDate: string;
  nextDate: string;
  orderStatus: "ORDER" | "NO_ORDER";
  recorderName: string;
  createdBy: string;
  version: number;
  lineCount: number;
  orderBagCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Report extends ReportSummary {
  lines: ReportLine[];
}

interface ProductFields {
  sourceNumber?: number;
  nameTh: string;
  labelMy: string;
  stockUnit: string;
  purchaseUnit: string;
  recommendedBags: number | null;
  itemsPerBag: number | null;
  hasStockField: boolean;
  isActive: boolean;
}

interface DashboardData {
  productCount: number;
  activeProductCount: number;
  reportCount: number;
  latestReport: ReportSummary | null;
}

function App() {
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    api<{ email: string }>("/api/session")
      .then((session) => setEmail(session.email))
      .catch((error: unknown) => setAuthError(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ"));
  }, []);

  if (authError) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="brand-mark"><Package size={25} /></div>
          <p className="eyebrow">DAVID MEATBALL · ADMIN</p>
          <h1>ระบบสต็อกสินค้า</h1>
          <p className="muted">{authError}</p>
          <p className="auth-hint">ระบบนี้เปิดสำหรับผู้ดูแลที่ได้รับอนุญาตเท่านั้น หากเพิ่งเข้าสู่ Cloudflare Access ให้โหลดหน้านี้ใหม่</p>
          <div className="auth-actions"><a className="button button-outline" href="/cdn-cgi/access/login">เข้าสู่ Cloudflare Access</a><button className="button button-dark" onClick={() => window.location.reload()}><RefreshCw size={16} /> โหลดใหม่</button></div>
        </div>
      </main>
    );
  }

  if (!email) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-lockup">
          <span className="brand-mark"><Package size={21} /></span>
          <span><b>David Meatball</b><small>Inventory workspace</small></span>
        </Link>
        <nav className="main-nav" aria-label="เมนูหลัก">
          <NavLink to="/" end><LayoutDashboard size={16} /> ภาพรวม</NavLink>
          <NavLink to="/reports"><ClipboardList size={16} /> รายงาน</NavLink>
          <NavLink to="/products"><Boxes size={16} /> สินค้า</NavLink>
        </nav>
        <div className="admin-pill"><ShieldCheck size={15} /><span>{email}</span></div>
      </header>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/new" element={<ReportEditor />} />
          <Route path="/reports/:id/edit" element={<ReportEditor />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="app-footer"><span>ระบบบันทึกสต็อกและรายการสั่งของ</span><span>ข้อมูลจัดเก็บใน Cloudflare D1</span></footer>
    </div>
  );
}

function LoadingScreen() {
  return <main className="loading-screen"><LoaderCircle className="spin" size={22} /> กำลังโหลดข้อมูลผู้ดูแล…</main>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>
      {action}
    </div>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const [dashboard, recentReports] = await Promise.all([
        api<DashboardData>("/api/dashboard"),
        api<ReportSummary[]>("/api/reports?limit=6"),
      ]);
      if (!Array.isArray(recentReports)) throw new Error("รูปแบบข้อมูลรายงานล่าสุดไม่ถูกต้อง");
      setSummary(dashboard);
      setReports(recentReports);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <>
      <PageHeading
        eyebrow="ภาพรวมประจำวัน"
        title="สวัสดี, เริ่มจัดการสต็อกกัน"
        description="บันทึกยอดคงเหลือและจำนวนถุงที่ต้องสั่ง ตรวจประวัติได้ในที่เดียว"
        action={<div className="heading-actions"><a className="button button-outline" href="/submit" target="_blank" rel="noreferrer"><ExternalLink size={16} /> ฟอร์มสาธารณะ</a><Link className="button button-dark" to="/reports/new"><Plus size={17} /> บันทึกรายการวันนี้</Link></div>}
      />
      {error && <Notice message={error} onRetry={load} />}
      <section className="metric-grid">
        <MetricCard icon={<Boxes size={19} />} label="สินค้าทั้งหมด" value={summary?.productCount ?? "—"} suffix="รายการ" tone="sage" />
        <MetricCard icon={<Package size={19} />} label="สินค้าเปิดใช้งาน" value={summary?.activeProductCount ?? "—"} suffix="รายการ" tone="blue" />
        <MetricCard icon={<ClipboardList size={19} />} label="รายงานทั้งหมด" value={summary?.reportCount ?? "—"} suffix="รายการ" tone="peach" />
      </section>
      <section className="dashboard-grid">
        <div className="panel latest-panel">
          <div className="panel-heading"><div><p className="eyebrow">LATEST RECORD</p><h2>รายงานล่าสุด</h2></div><button className="icon-button" aria-label="โหลดข้อมูลใหม่" onClick={() => void load()} disabled={refreshing}><RefreshCw size={17} className={refreshing ? "spin" : ""} /></button></div>
          {summary?.latestReport ? (
            <Link to={`/reports/${summary.latestReport.id}`} className="latest-report-card">
              <div className="latest-icon"><CalendarDays size={21} /></div>
              <div><b>{formatThaiDate(summary.latestReport.reportDate)}</b><span>วันถัดไป {formatThaiDate(summary.latestReport.nextDate)} · {summary.latestReport.recorderName}</span></div>
              <StatusBadge status={summary.latestReport.orderStatus} /><ArrowUpRight size={17} className="latest-arrow" />
            </Link>
          ) : <EmptyState title="ยังไม่มีรายงาน" detail="เริ่มต้นด้วยการบันทึกสต็อกประจำวันรายการแรก" action={<Link className="button button-dark" to="/reports/new"><FilePlus2 size={16} /> สร้างรายงาน</Link>} />}
          <div className="panel-footer"><Link to="/reports">ดูรายงานทั้งหมด <ChevronRight size={16} /></Link></div>
        </div>
        <div className="quick-panel">
          <div className="quick-art"><ShoppingBasket size={35} strokeWidth={1.5} /><span>INVENTORY<br />MADE SIMPLE</span></div>
          <h2>บันทึกให้ง่าย<br />ย้อนดูได้ทุกวัน</h2>
          <p>จำนวนสั่งกรอกเองได้ทันที ข้อมูลชื่อสินค้าและขนาดบรรจุแก้ไขได้จากหน้าสินค้า</p>
          <Link className="text-link" to="/products">จัดการข้อมูลสินค้า <ArrowUpRight size={16} /></Link>
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>รายการล่าสุด</h2></div><Link className="text-link" to="/reports">ดูทั้งหมด <ChevronRight size={16} /></Link></div>
        <ReportTable reports={reports} />
      </section>
    </>
  );
}

function MetricCard({ icon, label, value, suffix, tone }: { icon: ReactNode; label: string; value: number | string; suffix: string; tone: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong>{value}<small>{suffix}</small></strong></article>;
}

function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams({ limit: "150" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    try {
      const result = await api<ReportSummary[]>(`/api/reports?${params}`);
      if (!Array.isArray(result)) throw new Error("รูปแบบข้อมูลรายงานไม่ถูกต้อง");
      setReports(result);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดรายงานไม่สำเร็จ"); }
  }
  useEffect(() => { void load(); }, [from, to, status]);

  const filtered = useMemo(() => reports.filter((report) => `${report.reportDate} ${report.recorderName}`.toLowerCase().includes(query.toLowerCase())), [reports, query]);
  const exportQuery = new URLSearchParams();
  if (from) exportQuery.set("from", from);
  if (to) exportQuery.set("to", to);
  if (status) exportQuery.set("status", status);

  return <>
    <PageHeading eyebrow="DAILY RECORDS" title="รายงานสต็อก" description="ค้นหา ตรวจสอบ และแก้ไขข้อมูลที่บันทึกไว้" action={<Link className="button button-dark" to="/reports/new"><Plus size={17} /> บันทึกรายงาน</Link>} />
    {error && <Notice message={error} onRetry={load} />}
    <section className="panel filter-panel">
      <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาวันที่หรือชื่อผู้บันทึก" /></label>
      <label className="filter-field"><span>ตั้งแต่</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="filter-field"><span>ถึง</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <select className="select-control" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="กรองสถานะ"><option value="">ทุกสถานะ</option><option value="ORDER">สั่งของ</option><option value="NO_ORDER">ไม่สั่งของ</option></select>
      <a className="button button-outline" href={`/api/export.csv?${exportQuery}`}><ArrowDownToLine size={16} /> CSV</a>
    </section>
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">{filtered.length} RECORDS</p><h2>รายการบันทึก</h2></div></div><ReportTable reports={filtered} /></section>
  </>;
}

function ReportTable({ reports }: { reports: ReportSummary[] }) {
  if (reports.length === 0) return <EmptyState title="ไม่พบรายงาน" detail="ปรับตัวกรองหรือสร้างรายงานใหม่" />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>วันที่บันทึก</th><th>วันต่อไป</th><th>ผู้บันทึก</th><th>สถานะ</th><th>จำนวนสั่ง</th><th aria-label="เปิดรายการ"></th></tr></thead><tbody>
    {reports.map((report) => <tr key={report.id}><td className="strong-cell">{formatThaiDate(report.reportDate)}</td><td>{formatThaiDate(report.nextDate)}</td><td>{report.recorderName}</td><td><StatusBadge status={report.orderStatus} /></td><td>{formatNumber(report.orderBagCount)} ถุง</td><td><Link className="row-link" to={`/reports/${report.id}`} aria-label="เปิดรายงาน"><ArrowUpRight size={17} /></Link></td></tr>)}
  </tbody></table></div>;
}

function ReportEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const idempotencyKey = useRef<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reportDate, setReportDate] = useState(bangkokDate());
  const [nextDate, setNextDate] = useState(addDays(bangkokDate(), 1));
  const [orderStatus, setOrderStatus] = useState<"ORDER" | "NO_ORDER">("ORDER");
  const [recorderName, setRecorderName] = useState("");
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const allProducts = await api<Product[]>("/api/products?all=true");
        const report = id ? await api<Report>(`/api/reports/${id}`) : null;
        if (!active) return;
        setProducts(report
          ? allProducts.filter((product) => product.isActive || report.lines.some((line) => line.productId === product.id))
          : allProducts.filter((product) => product.isActive));
        if (report) {
          setReportDate(report.reportDate);
          setNextDate(report.nextDate);
          setOrderStatus(report.orderStatus);
          setRecorderName(report.recorderName);
          setVersion(report.version);
          setLines(allProducts.map((product) => {
            const line = report.lines.find((item) => item.productId === product.id);
            return { productId: product.id, remainingQuantity: line?.remainingQuantity ?? null, orderQuantity: line?.orderQuantity ?? null };
          }).filter((line) => allProducts.some((product) => product.id === line.productId && (product.isActive || report.lines.some((saved) => saved.productId === product.id)))));
        } else {
          setLines(allProducts.filter((product) => product.isActive).map((product) => ({ productId: product.id, remainingQuantity: null, orderQuantity: null })));
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  function changeLine(productId: string, field: "remainingQuantity" | "orderQuantity", raw: string) {
    const value = raw === "" ? null : Number(raw);
    setLines((current) => current.map((line) => line.productId === productId ? { ...line, [field]: value } : line));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = { reportDate, nextDate, orderStatus, recorderName, lines, ...(id ? { version } : {}) };
    if (!id && !idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    try {
      const report = await api<Report>(id ? `/api/reports/${id}` : "/api/reports", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        ...(id ? {} : { headers: { "Idempotency-Key": idempotencyKey.current! } }),
      });
      navigate(`/reports/${report.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingScreen />;
  return <>
    <button className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={16} /> กลับ</button>
    <PageHeading eyebrow={id ? "EDIT DAILY RECORD" : "NEW DAILY RECORD"} title={id ? "แก้ไขรายงานสต็อก" : "บันทึกสต็อกประจำวัน"} description="กรอกยอดคงเหลือและจำนวนถุงที่จะสั่งด้วยตนเอง" />
    {error && <Notice message={error} />}
    <form className="report-form" onSubmit={save}>
      <section className="panel form-panel">
        <div className="section-title"><span className="step-number">01</span><div><h2>ข้อมูลรายงาน</h2><p>ข้อมูลวันที่และผู้บันทึก</p></div></div>
        <div className="form-grid three-columns">
          <label className="input-group"><span>วันที่เพิ่ม <b>*</b></span><input required type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
          <label className="input-group"><span>วันต่อไป <b>*</b></span><input required type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label>
          <label className="input-group"><span>ชื่อผู้บันทึก <b>*</b></span><input required maxLength={120} value={recorderName} onChange={(event) => setRecorderName(event.target.value)} placeholder="ชื่อผู้บันทึก" /></label>
          <label className="input-group"><span>สถานะคำสั่ง</span><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value as "ORDER" | "NO_ORDER")}><option value="ORDER">สั่งของ</option><option value="NO_ORDER">ไม่สั่งของ</option></select></label>
        </div>
      </section>
      <section className="panel form-panel product-form-panel">
        <div className="section-title"><span className="step-number">02</span><div><h2>ยอดคงเหลือและจำนวนสั่ง</h2><p>จำนวนสั่งเป็นถุงและกรอกเอง ระบบไม่คำนวณ</p></div><span className="field-counter">{products.length} สินค้า</span></div>
        <div className="product-input-list">
          {products.map((product, index) => {
            const line = lines.find((item) => item.productId === product.id);
            if (!line) return null;
            return <article className="product-input-row" key={product.id}>
              <div className="product-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="product-input-name"><b>{product.nameTh}</b><span lang="my">{product.labelMy}</span>{!product.isActive && <em>ปิดใช้งาน · รายการเก่า</em>}</div>
              {product.hasStockField ? <label className="quantity-field"><span>เหลือ <small>{product.stockUnit}</small></span><input type="number" min="0" step="any" value={line.remainingQuantity ?? ""} onChange={(event) => changeLine(product.id, "remainingQuantity", event.target.value)} placeholder="—" /></label> : <div className="quantity-field quantity-hidden"><span>ยอดคงเหลือ</span><small>ฟอร์มต้นฉบับไม่มีช่องนี้</small></div>}
              <label className="quantity-field order-field"><span>{product.nameTh} <small>{product.purchaseUnit}</small></span><input type="number" min="0" step="1" value={line.orderQuantity ?? ""} onChange={(event) => changeLine(product.id, "orderQuantity", event.target.value)} placeholder="จำนวนถุง" /></label>
              <div className="package-hint">{product.recommendedBags !== null ? <span>แนะนำ {formatNumber(product.recommendedBags)} ถุง</span> : <span>ตั้งค่าจำนวนแนะนำได้ที่หน้าสินค้า</span>}{product.itemsPerBag !== null && <span> · {formatNumber(product.itemsPerBag)} {product.stockUnit}/ถุง</span>}</div>
            </article>;
          })}
        </div>
      </section>
      <div className="form-actions"><Link className="button button-outline" to={id ? `/reports/${id}` : "/reports"}>ยกเลิก</Link><button className="button button-dark" type="submit" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{saving ? "กำลังบันทึก…" : "บันทึกรายงาน"}</button></div>
    </form>
  </>;
}

function ReportDetailPage() {
  const { id = "" } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Report>(`/api/reports/${id}`).then(setReport).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "โหลดรายงานไม่สำเร็จ")); }, [id]);
  if (error) return <Notice message={error} />;
  if (!report) return <LoadingScreen />;
  return <>
    <Link className="back-link" to="/reports"><ArrowLeft size={16} /> กลับไปรายงาน</Link>
    <PageHeading eyebrow="DAILY REPORT" title={`รายงาน ${formatThaiDate(report.reportDate)}`} description={`ผู้บันทึก ${report.recorderName} · วันต่อไป ${formatThaiDate(report.nextDate)}`} action={<Link className="button button-dark" to={`/reports/${report.id}/edit`}><Pencil size={16} /> แก้ไขรายงาน</Link>} />
    <section className="detail-summary"><div className="detail-summary-card"><span>สถานะคำสั่ง</span><StatusBadge status={report.orderStatus} /></div><div className="detail-summary-card"><span>จำนวนสั่งทั้งหมด</span><b>{formatNumber(report.orderBagCount)} ถุง</b></div><div className="detail-summary-card"><span>จำนวนสินค้า</span><b>{report.lineCount} รายการ</b></div></section>
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">INVENTORY DETAILS</p><h2>รายละเอียดสินค้า</h2></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>สินค้า</th><th>ยอดคงเหลือ</th><th>จำนวนสั่ง</th><th>บรรจุภัณฑ์</th></tr></thead><tbody>{report.lines.map((line) => <tr key={line.productId}><td className="strong-cell"><span>{line.productNameTh}</span><small className="myanmar-text">{line.productLabelMy}</small></td><td>{formatNumber(line.remainingQuantity)} {line.remainingQuantity === null ? "" : line.stockUnit}</td><td>{formatNumber(line.orderQuantity)} {line.orderQuantity === null ? "" : line.purchaseUnit}</td><td>{line.recommendedBags === null && line.itemsPerBag === null ? "—" : `${formatNumber(line.recommendedBags)} ถุงแนะนำ · ${formatNumber(line.itemsPerBag)} ${line.stockUnit}/ถุง`}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setProducts(await api<Product[]>(`/api/products${showInactive ? "?all=true" : ""}`));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดสินค้าไม่สำเร็จ"); }
  }
  useEffect(() => { void load(); }, [showInactive]);
  const filtered = useMemo(() => products.filter((product) => `${product.nameTh} ${product.labelMy}`.toLowerCase().includes(query.toLowerCase())), [products, query]);

  return <>
    <PageHeading eyebrow="PRODUCT CATALOG" title="สินค้าและหน่วยบรรจุ" description="แก้ชื่อไทย ป้ายพม่า หน่วยคงเหลือ และข้อมูลถุงได้ โดยไม่เปลี่ยนประวัติเดิม" action={<button className="button button-dark" onClick={() => setCreating((value) => !value)}><Plus size={17} /> เพิ่มสินค้า</button>} />
    {notice && <div className="success-notice"><Check size={16} /> {notice}<button onClick={() => setNotice("")} aria-label="ปิด"><X size={15} /></button></div>}
    {error && <Notice message={error} onRetry={load} />}
    <section className="panel filter-panel product-filter"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อสินค้า" /></label><label className="checkbox-label"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> แสดงสินค้าปิดใช้งาน</label><span className="muted">{filtered.length} รายการ</span></section>
    {creating && <ProductEditor onCancel={() => setCreating(false)} onSaved={(product) => { setProducts((current) => [product, ...current]); setCreating(false); setNotice("เพิ่มสินค้าแล้ว"); }} />}
    <section className="panel product-list-panel"><div className="panel-heading"><div><p className="eyebrow">PRODUCT SETTINGS</p><h2>รายการสินค้า</h2></div><Settings2 size={18} className="muted" /></div>
      <div className="product-admin-list">{filtered.map((product) => <ProductEditor key={product.id} product={product} onSaved={(saved) => { setProducts((current) => current.map((item) => item.id === saved.id ? saved : item)); setNotice(`บันทึก ${saved.nameTh} แล้ว`); }} onCancel={() => undefined} />)}</div>
    </section>
  </>;
}

function ProductEditor({ product, onSaved, onCancel }: { product?: Product; onSaved: (product: Product) => void; onCancel: () => void }) {
  const [open, setOpen] = useState(!product);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProductFields>(() => product ? {
    sourceNumber: product.sourceNumber,
    nameTh: product.nameTh,
    labelMy: product.labelMy,
    stockUnit: product.stockUnit,
    purchaseUnit: product.purchaseUnit,
    recommendedBags: product.recommendedBags,
    itemsPerBag: product.itemsPerBag,
    hasStockField: product.hasStockField,
    isActive: product.isActive,
  } : {
    nameTh: "", labelMy: "", stockUnit: "ไม้", purchaseUnit: "ถุง",
    recommendedBags: null, itemsPerBag: null, hasStockField: true, isActive: true,
  });

  function setField<K extends keyof ProductFields>(key: K, value: ProductFields[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function numberValue(value: string) { return value === "" ? null : Number(value); }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await api<Product>(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, ...(product ? { version: product.version } : {}) }),
      });
      onSaved(saved);
      setOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกสินค้าไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  if (product && !open) return <article className={`product-admin-row ${product.isActive ? "" : "is-inactive"}`}>
    <span className="catalog-order">{String(product.sortOrder).padStart(2, "0")}</span>
    <div className="catalog-name"><b>{product.nameTh}</b><span lang="my">{product.labelMy}</span></div>
    <span className="unit-chip">{product.stockUnit} / {product.purchaseUnit}</span>
    <span className="catalog-pack">{product.recommendedBags === null ? "ยังไม่ตั้งค่าถุงแนะนำ" : `แนะนำ ${formatNumber(product.recommendedBags)} ถุง`}{product.itemsPerBag !== null ? ` · ${formatNumber(product.itemsPerBag)} ${product.stockUnit}/ถุง` : ""}</span>
    <StatusBadge status={product.isActive ? "ACTIVE" : "INACTIVE"} />
    <button className="icon-button" onClick={() => setOpen(true)} aria-label={`แก้ไข ${product.nameTh}`}><Pencil size={16} /></button>
  </article>;

  return <form className={`product-editor ${product ? "product-editor-expanded" : "product-create-card"}`} onSubmit={save}>
    {product && <div className="editor-title"><div><p className="eyebrow">แก้ไขสินค้า · #{product.sourceNumber}</p><h3>{product.nameTh}</h3></div><button className="icon-button" type="button" onClick={() => { setOpen(false); onCancel(); }} aria-label="ปิด"><X size={16} /></button></div>}
    {error && <p className="inline-error">{error}</p>}
    <div className="product-edit-grid">
      <label className="input-group"><span>ชื่อสินค้าไทย <b>*</b></span><input required maxLength={160} value={form.nameTh} onChange={(event) => setField("nameTh", event.target.value)} /></label>
      <label className="input-group"><span>ป้ายภาษาเมียนมา</span><input maxLength={160} lang="my" value={form.labelMy} onChange={(event) => setField("labelMy", event.target.value)} /></label>
      <label className="input-group"><span>หน่วยคงเหลือ</span><input required maxLength={40} value={form.stockUnit} onChange={(event) => setField("stockUnit", event.target.value)} /></label>
      <label className="input-group"><span>หน่วยสั่งซื้อ</span><input required maxLength={40} value={form.purchaseUnit} onChange={(event) => setField("purchaseUnit", event.target.value)} /></label>
      <label className="input-group"><span>จำนวนถุงแนะนำ</span><input type="number" min="0" step="1" value={form.recommendedBags ?? ""} onChange={(event) => setField("recommendedBags", numberValue(event.target.value))} placeholder="ไม่ระบุ" /></label>
      <label className="input-group"><span>จำนวนไม้ต่อถุง</span><input type="number" min="0" step="1" value={form.itemsPerBag ?? ""} onChange={(event) => setField("itemsPerBag", numberValue(event.target.value))} placeholder="ไม่ระบุ" /></label>
    </div>
    <div className="product-edit-options"><label className="checkbox-label"><input type="checkbox" checked={form.hasStockField} onChange={(event) => setField("hasStockField", event.target.checked)} /> มีช่องบันทึกยอดคงเหลือ</label><label className="checkbox-label"><input type="checkbox" checked={form.isActive} onChange={(event) => setField("isActive", event.target.checked)} /> เปิดใช้งาน</label></div>
    <div className="editor-actions">{!product && <button type="button" className="button button-outline" onClick={onCancel}>ยกเลิก</button>}<button className="button button-dark" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{saving ? "กำลังบันทึก…" : product ? "บันทึกการแก้ไข" : "สร้างสินค้า"}</button></div>
  </form>;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "ORDER" ? "สั่งของ" : status === "NO_ORDER" ? "ไม่สั่งของ" : status === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน";
  return <span className={`status-badge ${status.toLowerCase().replaceAll("_", "-")}`}>{label}</span>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><ClipboardList size={22} /></span><b>{title}</b><p>{detail}</p>{action}</div>;
}

function Notice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-notice"><span>{message}</span>{onRetry && <button onClick={onRetry}>ลองอีกครั้ง</button>}</div>;
}

function NotFound() {
  return <div className="panel not-found"><h1>ไม่พบหน้านี้</h1><Link className="text-link" to="/">กลับไปภาพรวม <ChevronRight size={16} /></Link></div>;
}

export default App;
