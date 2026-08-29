# Koneksi DBeaver ke PostgreSQL

Aplikasi memakai PostgreSQL. Nilai koneksi diambil dari **`server/.env`** di host yang sama dengan database (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). Template: [server/env.example](../../server/env.example).

Default di example: host `localhost`, port **5432**, database `manufacturing_db`. VPS bisa memakai port atau user lain — jangan mengasumsikan 5433 atau username tertentu.

## Nilai yang diisi di DBeaver

| Field | Sumber |
|-------|--------|
| Host | `DB_HOST` (dari mesin DBeaver: `localhost` jika tunnel/SSH ke VPS; atau host yang diizinkan firewall) |
| Port | `DB_PORT` (default 5432) |
| Database | `DB_NAME` |
| Username | `DB_USER` |
| Password | `DB_PASSWORD` (jangan tulis di git / chat) |

## Setup

1. Database → New Connection → PostgreSQL.
2. Isi Main tab dari tabel di atas.
3. Driver Properties (opsional): `connectTimeout=30`, `socketTimeout=60`, `tcpKeepAlive=true`.
4. Remote: tab SSH — tunnel ke VPS, Remote Host `localhost`, Remote Port = `DB_PORT` di VPS.
5. Test Connection → Finish.

Jangan expose PostgreSQL ke internet. Akses remote lewat SSH tunnel atau VPN.

## Test query

```sql
SELECT current_user, current_database();
SELECT COUNT(*) FROM production_liquid;
```

## Troubleshooting

- Timeout: naikkan `connectTimeout` / `socketTimeout`, atau pakai SSH tunnel.
- Auth gagal: user/password harus sama dengan `.env` aplikasi; cek `pg_hba.conf` di server.
- Port salah: baca `DB_PORT` di `server/.env` host, bukan dokumentasi lama.

Password dan host asli tidak boleh masuk ke repository.
