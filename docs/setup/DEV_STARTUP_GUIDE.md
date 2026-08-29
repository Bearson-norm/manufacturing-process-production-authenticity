# Development Startup Guide

## `npm run dev`

Dari root repo, perintah ini menjalankan:

1. Backend (nodemon) — proses API, `PORT` default **1234**
2. Client React — **3000**, proxy `/api` ke backend

Keduanya lewat `concurrently`. Buka UI di `http://localhost:3000`. Curl API ke `http://localhost:1234`.

Prasyarat: PostgreSQL berjalan, `server/.env` sudah diisi (`cp server/env.example server/.env`).

## Yang diharapkan

- Server log: koneksi PostgreSQL berhasil, migrasi/schema bootstrap, lalu listen di `PORT`.
- Client: CRA compiled, Local `http://localhost:3000`.

Jangan mengandalkan jumlah tabel, nama database, atau cuplikan password dari log lama. Schema di-bootstrap dari `server/schema-bootstrap.js` dan `server/migrations/`.

## Konfigurasi database

File env: **`server/.env`** (bukan root).

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=replace_with_strong_password
```

Setelah mengubah `.env`, restart `npm run dev`.

Verifikasi cepat: `GET http://localhost:1234/health` harus `status: healthy` dan `database: connected`.

## Troubleshooting

### Database does not exist

Buat database yang sama dengan `DB_NAME`:

```sql
CREATE DATABASE manufacturing_db;
```

### Output concurrently campur

Jalankan terpisah dari root:

```bash
npm run server
npm run client
```

### Port in use

Lihat [PORT_CONFIGURATION.md](PORT_CONFIGURATION.md).

## Catatan

- Jangan commit `server/.env`.
- Jangan curl ke `:3000` jika Anda ingin menembak proses API langsung; proxy hanya untuk request browser ke `/api`.
