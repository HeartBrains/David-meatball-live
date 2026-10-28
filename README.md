# David Meatball Live

ระบบบันทึกสต็อกและรายการสั่งของ ภาษาไทยพร้อมป้ายภาษาเมียนมา ใช้ Cloudflare Workers, Hono, D1, React/Vite และ MCP Streamable HTTP

## Production

- URL: [https://david-meatball-live.thaicms.workers.dev](https://david-meatball-live.thaicms.workers.dev)
- Cloudflare Access ครอบ URL นี้และใช้ allowlist ผู้ดูแลเดิม; Worker ตรวจ `ADMIN_EMAILS` ซ้ำจาก secret
- D1 `david-meatball-live-db` สร้างแล้วและใช้ migration เริ่มต้นแล้ว
- MCP ปิดไว้ (`MCP_ENABLED=false`) จนกว่าจะต้องการเปิดใช้งาน
- ยังไม่ได้ผูก custom domain; ใช้ URL `workers.dev` ข้างต้น

## ขอบเขตรุ่นแรก

- ผู้ดูแลหนึ่งบัญชี เข้าผ่าน Cloudflare Access และ Worker ตรวจอีเมลซ้ำกับ `ADMIN_EMAILS`
- กรอกยอดคงเหลือและจำนวนสั่งเป็นถุงเอง ระบบไม่คำนวณจำนวนสั่งและไม่มีขั้นอนุมัติซ้ำ
- แก้ metadata สินค้า เช่น จำนวนถุงแนะนำและจำนวนไม้ต่อถุงได้ โดยไม่เปลี่ยน snapshot ในรายงานเก่า
- บันทึก/แก้ไขรายงาน ดูประวัติ และส่งออก CSV
- MCP อ่าน เพิ่ม และแก้ไขข้อมูลผ่าน service layer เดียวกับ API; endpoint ไม่เปิดสาธารณะ
- เริ่มบันทึกข้อมูลใหม่ ไม่ sync Paperform/Google; ออกแบบให้เพิ่ม CSV import ของข้อมูลเก่าในงานภายหลัง

รายละเอียด requirements และป้ายสินค้าไทย/เมียนมาอยู่ใน [spec.md](./spec.md)

## พัฒนาในเครื่อง

ต้องใช้ Node.js 22 ขึ้นไปและ npm

```sh
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
```

เปิดสอง terminal:

```sh
npm run dev:worker
```

```sh
npm run dev
```

เปิด Vite ที่ `http://localhost:5173` ตัว Vite proxy ส่ง `/api`, `/mcp`, `/health` ไป Worker บนพอร์ต `8787` การยืนยันตัวตน local ใช้ `DEV_ADMIN_EMAIL` จาก `.dev.vars` และต้องตรงกับหนึ่งใน `ADMIN_EMAILS`.

## การตั้งค่า Cloudflare สำหรับบัญชีใหม่

ขั้นตอนนี้ไม่ต้องทำซ้ำกับ production ปัจจุบัน เว้นแต่ย้ายไป Cloudflare account ใหม่หรือสร้างระบบใหม่

1. สร้าง D1 และอัปเดต `database_id` ใน `wrangler.jsonc`:

   ```sh
   npx wrangler d1 create david-meatball-live-db
   ```

2. นำ migration ขึ้นฐานข้อมูล:

   ```sh
   npm run db:migrate:remote
   ```

3. เพิ่ม custom domain ให้ Worker แล้วสร้าง Cloudflare Access application ครอบ domain นั้น โดยมี allow policy สำหรับอีเมลผู้ดูแลเท่านั้น `workers.dev` ยังไม่ใช่หน้าล็อกอิน Access ของระบบนี้
4. ตั้ง Worker variables ใน Cloudflare Dashboard:

   - `ADMIN_EMAILS` — อีเมลแอดมิน คั่นหลายอีเมลด้วย comma หากจำเป็น
   - `CF_ACCESS_ISSUER` — issuer ของ Cloudflare Access เช่น `https://<team-name>.cloudflareaccess.com`
   - `CF_ACCESS_AUD` — AUD tag ของ Access application
   - `ENVIRONMENT=production`
   - `MCP_ENABLED=false` ก่อน; เปลี่ยนเป็น `true` เมื่อจะเปิด MCP

5. Deploy หลังตั้งค่า Access และ D1 เสร็จ:

   ```sh
   npm run deploy
   ```

หากยังใช้ D1 ID ตัวอย่าง `00000000-0000-0000-0000-000000000000` ห้าม deploy จนกว่าจะเปลี่ยนเป็น ID จริงจากขั้นตอนที่ 1

## MCP

- Endpoint: `https://<custom-domain>/mcp`
- Transport: Streamable HTTP แบบ stateless
- ส่ง Cloudflare Access JWT ใน `Cf-Access-Jwt-Assertion` หรือ `Authorization: Bearer <JWT>`
- อีเมลใน JWT ต้องผ่าน `ADMIN_EMAILS`; Worker ใช้ permission, validation และ audit เดียวกับหน้าเว็บ
- Tools: `list_products`, `list_daily_reports`, `get_daily_report`, `create_daily_report`, `update_daily_report`, `create_product`, `update_product`
- `MCP_ENABLED` ปิดไว้เป็นค่าเริ่มต้น

## Security notes

- ห้าม commit `.dev.vars`, Access tokens, database secrets หรือ credentials
- Cloudflare Access เป็นชั้นล็อกอิน; Worker ตรวจ signature, issuer, audience และอีเมล allowlist ซ้ำ
- มีเพียง `/health` ที่เปิดเป็น public status endpoint; routes อื่นต้องผ่าน admin middleware
- API และ MCP ไม่มีเครื่องมือ SQL หรือการลบข้อมูลแบบ hard delete
