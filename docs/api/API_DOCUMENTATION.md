# Manufacturing Process API

Kontrak HTTP dari handler saat ini (`server/app.js`, `server/routes/*`, `server/middleware/auth.middleware.js`).

Proses API memakai `PORT` (default **1234**). UI development di **:3000** hanya mem-proxy `/api`. Contoh curl di bawah menembak proses API: `http://localhost:<PORT>`. Ganti `<PORT>` dan `your_api_key_here` / JWT — jangan menempel token nyata.

Generate API key: login admin → Admin Configuration → Generate API Key. Key hanya ditampilkan sekali; di UI kemudian ter-mask.

---

## Matriks auth

| Zona | Path | Kredensial | Rate limit |
|------|------|------------|------------|
| Publik | `GET /health`, `GET /favicon.ico`, `POST /api/login` | Tidak ada | Login: 20 / 15 menit |
| API key | `/api/external/*`, `/api/receiver/*` | `X-API-Key` atau `Authorization: Bearer <api_key>` | 300 / 15 menit |
| JWT | sisa `/api/*` | `Authorization: Bearer <jwt>` role `admin` atau `production` | — |
| JWT + admin | `/api/admin/*`, `/api/reports/*`, `/api/wms/*`; tulis PIC/vendor | JWT role `admin` | — |

JWT **tidak** diterima di `/api/external` dan `/api/receiver`. API key **tidak** diterima di rute JWT (`X-API-Key` di rute JWT → 401, minta Bearer token).

### Trap: API key belum dikonfigurasi

Key disimpan di `admin_config` (`api_key`).

- `NODE_ENV` **production** atau **staging**: key kosong → **503**, body `API key is not configured. External API is disabled until an API key is set.` Ini fail-closed, bukan default yang disarankan.
- **development** saja: key kosong → request lolos tanpa header (untuk tes lokal).

### Error API key (jika key sudah ada)

| Status | Artinya | Body `error` (prefix) |
|--------|---------|------------------------|
| 401 | Header key tidak ada | `API key is required. Please provide X-API-Key header or Authorization Bearer token.` |
| 403 | Key tidak cocok | `Invalid API key` |
| 503 | Prod/staging dan key belum di-set | lihat trap di atas |
| 500 | Gagal baca DB | `Failed to verify API key` |

---

## Aturan domain (kontrak)

- **`production_type`** = halaman yang merekam data (`liquid` / `device` / `cartridge`), bukan format string `PROD/MO/xxxx`. MO yang sama bisa ada di lebih dari satu tipe. External manufacturing mencari ketiga tabel.
- **Completed-only:** `GET /api/external/manufacturing-data`, `.../by-date`, dan `.../manufacturing-report/simple` hanya baris `status = 'completed'`. Baris active/draft tidak ikut.
- Filter Odoo cartridge di cache: note di-OR untuk typo (`cartridge`, `cartirdge`, `cartrige`, …). Jangan “menyederhanakan” filter itu. Jika note kosong **dan** `team_name` bukan `LIQ…` / `G1`/`G2`/… / `DEV…`, SKU dengan `CARTRIDGE` (typo sama) atau token `CT` juga masuk cartridge.
- Filter Odoo liquid di cache: `team_name` prefix `LIQ` **atau** kode `G1`/`G2`/… **atau** note `TEAM/TIM LIQUID - SHIFT n` (dash opsional). Sync Odoo juga mencari pola note itu. Fallback SKU (note kosong + team tidak match): bukan MIXING/BRAY/POD/cartridge/CT → 15 ml jika bundling/`15 ML`/slof, selain itu 30 ml.
- Filter Odoo device di cache: `team_name` prefix `DEV` **atau** note TEAM/TIM DEVICE SHIFT. Fallback SKU: note kosong + team tidak match + token `POD` tanpa cartridge/CT. Note/team yang match tetap menang atas SKU.
- Dual nama field di banyak rute JWT: `moNumber` / `mo_number`, `startDate` / `start_date`. External manufacturing-data memakai `mo_number` (query).
- Authenticity di DB/internal sering camelCase (`firstAuthenticity`); respons external manufacturing-data memakai snake_case (`first_authenticity`).
- Buffer/reject GET: query `?moNumber=`, **bukan** path `.../liquid/PROD/MO/123`.
- Dua “combined”: `GET /api/combined-production` membaca tabel live `production_*`; `GET /api/production/combined` membaca tabel denormalisasi `production_combined`.

Endpoint yang **tidak ada**: `/api/production/stats`, `/api/production/by-mo/:moNumber`, `/api/production-results`, `POST /api/admin/config` (yang ada **PUT**), `POST /api/admin/sync-production` (yang ada `sync-production-data`), `update-mo-cache` / `cleanup-old-mo` (yang ada `sync-mo` / `cleanup-mo`).

---

## Publik

### GET /health

**Purpose:** Probe proses web dan koneksi PostgreSQL (Traefik/monitor).
**Auth:** public
**When:** Load balancer, Uptime Kuma, post-deploy check.

**Success:** 200 `{ status: "healthy", database: "connected", uptime, timestamp }`
**Errors:** 503 `{ status: "unhealthy", database: "disconnected", timestamp }` jika `SELECT 1` gagal.

Worker (`ENABLE_HTTP=false`) tidak menyajikan endpoint ini.

### POST /api/login

**Purpose:** Terbitkan JWT untuk UI dan rute `/api` yang dilindungi.
**Auth:** public (rate-limited)
**When:** Form login.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| username | body | string | yes | — | `ADMIN_USERNAME` atau `PRODUCTION_USERNAME` |
| password | body | string | yes | — | dari env (bcrypt atau plaintext) |

**Success:** 200 `{ success, message, role, username, token }` — `role` adalah `admin` atau `production`.
**Errors:** 400 username/password kosong; 401 kredensial salah; 503 jika password env wajib belum di-set (prod/staging).

```bash
curl -X POST "http://localhost:<PORT>/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'
```

---

## External (API key)

Semua path di bawah `/api/external`. Kirim key lewat header `X-API-Key` atau `Authorization: Bearer` (nilai: placeholder `your_api_key_here`, bukan key produksi).

### GET /api/external/authenticity

**Purpose:** Daftar baris produksi (semua status kecuali di-filter), tiga tipe.
**When:** Konsumen yang butuh dump authenticity, bukan hanya completed MO.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| type | query | string | no | semua | `liquid` / `device` / `cartridge` / `all` |
| status | query | string | no | semua | filter `status` baris |
| start_date | query | string | no | — | filter `created_at` >= |
| end_date | query | string | no | — | filter `created_at` <= |

**Success:** 200 `{ count, data }` — `data` hasil `parseAuthenticityData` per baris.
**Errors:** 500 `{ error }`

### POST /api/external/authenticity

Sama seperti GET; filter dari JSON body (`type`, `status`, `start_date`, `end_date`).

### GET /api/external/manufacturing-data

**Purpose:** Data manufacturing **completed** untuk satu MO: sesi, authenticity, buffer, reject.
**When:** Integrasi MES/dashboard eksternal.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| mo_number | query | string | yes | — | contoh `PROD/MO/28204` |
| completed_at | query | string | no | `all` | `YYYY-MM-DD` atau `all` |

**Success:** 200 `{ success, mo_number, completed_at, total_sessions, data[] }`. `data[]` grup per `session_id`: `session`, `leader`, `shift`, `mo_data[]` (termasuk `production_type`, `authenticity_data` snake_case, `buffered_auth`, `rejected_auth`). Jika tidak ada baris completed: `total_sessions: 0`, `data: []` (bukan 404).
**Errors:** 400 `MO Number is required`; 500.

`mo_data[].mo_number` diulang di nested object (handler masih mengirimkannya).

```bash
curl "http://localhost:<PORT>/api/external/manufacturing-data?mo_number=PROD/MO/xxxx&completed_at=all"
```

Sertakan header API key seperti di pengantar seksi External. Jangan menempel key nyata.

### GET /api/external/manufacturing-data/status

**Purpose:** Status agregat MO di ketiga tabel: `active` jika ada baris active; else `completed` jika ada completed; else 404.
**When:** Cek apakah MO masih berjalan.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| mo_number | query | string | yes | — | MO |
| completed_at | query | string | no | — | membatasi hitungan completed ke tanggal itu |

**Success:** 200 `{ status: "active" }` atau `{ status: "completed" }` (tanpa `success`).
**Errors:** 400 tanpa `mo_number`; 404 `{ success: false, error: "MO number not found", status: null }`.

Active menang jika kedua jenis ada.

### GET /api/external/manufacturing-data/by-date

**Purpose:** Daftar **unique** `mo_number` yang completed pada tanggal itu (tiga tipe digabung).
**When:** Listing harian. Bukan nested sessions.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| completed_at | query | string | yes | — | `YYYY-MM-DD` |

**Success:** 200 `{ success, completed_at, total_mos, mo_numbers: string[] }`
**Errors:** 400 jika `completed_at` hilang.

Bukan `{ total_mo, total_sessions, data[].sessions[] }`.

### GET /api/external/manufacturing-report/simple

**Purpose:** Baris completed di rentang tanggal (inclusive), tiga tipe.
**When:** Laporan ringkas.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| start_date | query | string | yes | — | `YYYY-MM-DD` |
| end_date | query | string | yes | — | `YYYY-MM-DD` |

**Success:** 200 `{ success, start_date, end_date, total_records, data[] }` dengan `mo_number`, `sku_name`, `pic`, `leader_name`, `shift_number`, `session_id`, `production_type`, `completed_at`.
**Errors:** 400 jika tanggal hilang.

---

## Receiver (API key)

Mount yang sama dengan API key. Webhook inbound; menulis `receiver_logs` dan/atau `manufacturing_identity`.

### POST /api/receiver/test

**Purpose:** Terima payload tes; audit ke `receiver_logs`.
**When:** Uji URL inbound.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| source | body atau query | string | no | `fallback` | `fallback` / `active` / `completed` |
| data | body | object | no | seluruh body | payload yang di-log |

**Success:** 200 received.
**Errors:** 400 source tidak valid.

### GET /api/receiver/test/logs

**Purpose:** Log audit terpaginasi.
**When:** Debug inbound.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| source | query | string | no | — | filter |
| limit | query | number | no | 50 | page size |
| offset | query | number | no | 0 | offset |

### GET /api/receiver/test/stats

**Purpose:** Agregat log per `source`.

### POST /api/receiver/manufacturing

**Purpose:** Upsert identitas manufacturing **active** (`manufacturing_identity`).
**When:** Sistem eksternal menandai MO mulai.

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| manufacturing_id | body | string | yes | — | biasanya MO |
| sku | body | string | yes | — | SKU |
| sku_name | body | string | yes | — | nama |
| target_qty | body | number | yes | — | boleh 0 |
| leader_name | body | string | yes | — | leader |
| done_qty | body | number | no | — | |
| finished_at | body | string | no | — | |

**Success:** 200 `{ success, message, manufacturing_id, status: "active", received_at }`
**Errors:** 400 field wajib hilang; 500 DB.

### PUT /api/receiver/manufacturing/:manufacturing_id(*)

**Purpose:** Tandai completed. Wildcard `*` agar `PROD/MO/xxxx` (slash) masuk path. Encode URL jika perlu.
**When:** MO selesai di sistem eksternal.

Body wajib: `sku`, `sku_name`, `target_qty`, `leader_name`. Path boleh numeric `id` baris atau `manufacturing_id`.

**Notes:** `GET /api/receiver/manufacturing/:manufacturing_id` **tanpa** wildcard — MO dengan `/` bisa tidak match. Listing: `GET /api/receiver/manufacturing?manufacturing_id=`.

### GET /api/receiver/manufacturing

**Purpose:** List identity. Filter `status`, `manufacturing_id`; `limit` default 100, `offset` default 0. Timestamp direspons zona Jakarta.

---

## Katalog JWT (UI / admin)

Semua butuh `Authorization: Bearer <jwt>` kecuali disebut admin. Detail body: baca handler; ini indeks.

### Production — JWT

| METHOD | Path | Purpose |
|--------|------|---------|
| GET | `/api/production/liquid` | Sesi liquid; query `variant=15ml\|30ml` |
| GET | `/api/production/device` | Sesi device |
| GET | `/api/production/cartridge` | Sesi cartridge |
| GET | `/api/production/active-mo-status` | MO active terbaru per tipe (liquid 15/30) |
| GET | `/api/production/report` | Laporan flat; filter `type`, `mo_number`, `pic`, `date_from`, `date_to`, `status` |
| POST | `/api/production/liquid` | Buat baris; `save_mode`: `draft` / `confirm` / `confirm_draft` |
| POST | `/api/production/device` | Buat device |
| POST | `/api/production/cartridge` | Buat cartridge |
| PUT | `/api/production/{type}/end-session` | Akhiri sesi |
| PUT | `/api/production/{type}/update-status/:id` | Submit / update status |
| PUT | `/api/production/liquid/submit-mo-group` | Bulk submit (liquid saja) |
| PUT | `/api/production/liquid/revert-mo-group/:mo_number` | Revert (liquid saja) |
| PUT | `/api/production/{type}/:id` | Edit baris |
| GET | `/api/production/check-mo-used` | Query `moNumber`, `productionType` |
| GET | `/api/production/combined` | Tabel `production_combined` |
| POST | `/api/production/combined` | Insert combined |
| POST | `/api/production/combined/sync` | Sync dari tabel tipe |
| GET | `/api/combined-production` | Alias legacy: query **tabel live** `production_*`, bukan `production_combined` |

### Buffer / reject — JWT

Pola `liquid` / `device` / `cartridge`: GET `?moNumber=` wajib; POST create; POST `.../batch` `{ moNumbers: [] }`; PUT `/:id`.

### PIC / vendor — JWT; tulis = admin

| METHOD | Path | Auth |
|--------|------|------|
| GET | `/api/pic/list` | JWT |
| GET | `/api/pic/all` | admin |
| POST | `/api/pic/add` | admin |
| PUT | `/api/pic/update/:id` | admin |
| DELETE | `/api/pic/delete/:id` | admin (soft) |
| GET | `/api/authenticity-vendors` | JWT (aktif) |
| GET/POST/PUT/DELETE | `/api/authenticity-vendors` (+ `/all`, `/:id`) | admin untuk tulis dan `/all` |

### Odoo / search / statistics — JWT

| METHOD | Path | Notes |
|--------|------|-------|
| GET | `/api/odoo/mo-list` | Query **`productionType` wajib**. Liquid: LIQ% / G1… / TEAM LIQUID SHIFT, atau SKU fallback note kosong. Device: DEV% / note, atau SKU `POD` saja. Cartridge: note typo-tolerant, atau SKU CARTRIDGE/CT. |
| GET | `/api/search/mo` | Query **`q` wajib** pada `odoo_mo_cache` |
| GET | `/api/statistics/production-by-leader` | `period`, `productionType` |
| GET | `/api/statistics/leaders` | Nama leader unik |

### Admin — JWT + admin

| METHOD | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/config` | Config Odoo/external/WMS/API key (masked) + `moCacheSyncEnabled` |
| PUT | `/api/admin/config` | Update Odoo/external (tidak mengubah flag MO cache) |
| PUT | `/api/admin/mo-cache-sync` | Toggle pull otomatis Odoo → `odoo_mo_cache` |
| PUT | `/api/admin/wms-config` | Kredensial WMS |
| POST | `/api/admin/generate-api-key` | Generate + simpan key |
| GET | `/api/admin/mo-stats` | Statistik cache MO + `last_sync` |
| GET | `/api/admin/test-connection` | Tes sesi Odoo |
| POST | `/api/admin/cleanup-mo` | Purge `odoo_mo_cache` lama |
| POST | `/api/admin/sync-production-data` | Full sync production_results |
| POST | `/api/admin/push-external-manufacturing-idle` | Push idle liquid ke MES |
| POST | `/api/admin/reconcile-external-manufacturing-finished` | Rekonsiliasi finished |
| POST | `/api/admin/sync-mo` | Sync cache Odoo manual (tidak diblokir toggle) |
| GET | `/api/admin/external-manufacturing/resolve-id` | UUID eksternal dari MO |
| POST | `/api/admin/external-manufacturing/send` | Kirim payload MES |
| GET | `/api/reports/manufacturing` | Dashboard report |

Idle/reconcile/send: target outbound bisa **lebih dari satu** (`EXTERNAL_API_TARGETS` / config), bukan satu URL MES.

#### GET /api/admin/config

**Purpose:** Baca konfigurasi Admin (Odoo, MES, WMS, API key) untuk form UI; secret ter-mask.
**Auth:** JWT (`admin`)
**When:** Halaman Admin load.

**Success:** 200 `{ success, config }` — `config.moCacheSyncEnabled` boolean; key `admin_config` `odoo_mo_cache_sync_enabled` belum ada → **true** (pull otomatis tetap jalan seperti sebelum toggle ada).
**Errors:** 401/403 auth; 500 unexpected.

#### PUT /api/admin/mo-cache-sync

**Purpose:** Simpan flag apakah worker boleh menarik MO dari Odoo ke `odoo_mo_cache` tiap menit.
**Auth:** JWT (`admin`)
**When:** Toggle di seksi MO Data Management (langsung persist, bukan Save Configuration).

| Param | In | Type | Required | Default | Meaning |
|-------|----|------|----------|---------|---------|
| enabled | body | boolean | yes | — | `true` = cron + initial sync menarik Odoo; `false` = skip pull |

**Success:** 200 `{ success: true, enabled }`
**Errors:** 400 jika `enabled` bukan boolean; 401/403 auth; 500 DB tidak tersedia / upsert gagal.
**Notes:** Hanya nilai tersimpan `false` / `0` / `off` yang mematikan. Cron MES idle dan `production_results` tidak terpengaruh. `POST /api/admin/sync-mo` tetap jalan sebagai override manual. Worker harus `ENABLE_SCHEDULER=true` agar cron 1 menit berjalan; proses web saja tidak menarik otomatis.

#### GET /api/admin/mo-stats

**Purpose:** Hitungan cache MO untuk kartu Admin.
**Auth:** JWT (`admin`)
**When:** Admin load, setelah cleanup, setelah Sync Now.

**Success:** 200 `{ success, stats: { total, recent_24h, older_than_7_days, last_sync } }` — `last_sync` adalah `MAX(fetched_at)` atau `null` jika cache kosong.
**Errors:** 401/403 auth; 500 query gagal.

#### POST /api/admin/sync-mo

**Purpose:** Tarik MO liquid/device/cartridge dari Odoo (30 hari) dan upsert `odoo_mo_cache`, lalu backfill `team_name`.
**Auth:** JWT (`admin`)
**When:** Tombol "Sync MO dari Odoo sekarang"; juga override saat toggle otomatis OFF.

**Success:** 200 `{ success, message, totalUpdated, backfilledTeamNames, results, timestamp }`
**Errors:** 400 konfigurasi Odoo (session/base URL) kosong; 401/403 auth; 500 kegagalan sync.
**Notes:** Tidak membaca `odoo_mo_cache_sync_enabled`. Butuh session Odoo valid.

### WMS — JWT + admin

`POST /api/wms/sync-mo`, `sync-mo-batch`, `test-connection`, `verify-authenticity`, `verify-all-qr`; `GET /api/wms/cartons`, `cartons/export`, `cartons/:id`, `compare`, `mo-list`, `mo-accuracy-report`, `mo-accuracy-report/mo-list`, `mo-accuracy-report/export-summary`, `mo-qty-compare-report`, `mo-qty-compare-report/detail`.

---

## Related

- [README.md](../../README.md) — ringkasan auth
- [docs/setup/ENVIRONMENT_SETUP.md](../setup/ENVIRONMENT_SETUP.md)
- [docs/setup/PORT_CONFIGURATION.md](../setup/PORT_CONFIGURATION.md)
- [SECURITY_RECOMMENDATIONS.md](../../SECURITY_RECOMMENDATIONS.md)
