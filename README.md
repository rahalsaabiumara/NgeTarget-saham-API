# NgeTarget Saham — REST API & Dokumentasi API

Repositori khusus **Backend REST API, Engine Kalkulasi/Forecasting, dan Dokumentasi Spesifikasi API** untuk proyek **NgeTarget Saham (PortoCalc AI)**.

> Untuk repositori utama *fullstack* (beserta antarmuka Dashboard React + TypeScript), kunjungi: **[rahalsaabiumara/NgeTarget-saham](https://github.com/rahalsaabiumara/NgeTarget-saham)**.

---

## Dokumen & Spesifikasi API

| Dokumen | Format | Deskripsi |
| :--- | :--- | :--- |
| **[`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)** | Markdown | Referensi lengkap seluruh endpoint REST API, skema validasi, contoh `curl`, respons JSON, kode status HTTP, dan rumus matematika. |
| **[`docs/openapi.yaml`](docs/openapi.yaml)** | OpenAPI 3.1 (YAML) | Spesifikasi standar industri — siap diimpor ke Swagger, Scalar, Bruno, Insomnia, atau Hoppscotch. |
| **[`docs/postman_collection.json`](docs/postman_collection.json)** | Postman v2.1 (JSON) | Koleksi siap pakai berisi contoh request terstruktur untuk seluruh endpoint. |
| **`GET /api/docs`** | Interactive HTML | Halaman dokumentasi API interaktif (*Scalar API Reference*) langsung dari server lokal (`http://localhost:4000/api/docs`). |

---

## Fitur Utama API

1. **Market Data Saham BEI/IDX & Emas (`yahoo-finance2`)**
   - Kuotasi harga *live* `BELI` (*ask*), `JUAL` (*bid*), dan `lastPrice` untuk saham Bursa Efek Indonesia (`.JK`) serta harga emas spot dunia dalam Rupiah per gram (`XAU-IDR`).
   - Dilengkapi *in-memory TTL cache* dan *persistent fallback cache* di SQLite (`MarketQuoteCache`).
2. **Engine Kalkulasi Spreadsheet & Simulasi *What-If***
   - Menghitung `%RUGI` (*spread*), `L/R` nominal, `%L/R`, status pencapaian target, harga jual impas (*break-even*), serta harga jual menuju target secara presisi.
3. **Penyimpanan Persisten SQLite (`Prisma ORM`) & Ekspor CSV**
   - CRUD catatan portofolio aktual maupun simulasi, *auto-seeding* contoh referensi `HRTA`, dan ekspor `.csv` ber-BOM UTF-8 untuk Microsoft Excel / Google Sheets.
4. **Model Forecasting Perkembangan Aset**
   - Proyeksi bulanan (1–60 bulan) dalam skenario *Optimis (Bull)*, *Moderat (Base)*, dan *Pesimis (Bear)* berbasis tren historis harian maupun asumsi *return* + setoran rutin (DCA).
5. **Gemini AI Portfolio Advisor (`@google/genai`)**
   - Diagnosis posisi, evaluasi beban *spread*, dan rekomendasi tindakan berbasis JSON Schema terstruktur dengan *caching* SHA-256 di SQLite serta *fallback rule-based* otomatis apabila `GEMINI_API_KEY` belum diisi.

---

## Struktur Direktori

```text
NgeTarget-saham-API/
├── backend/                  # Express 5 + Prisma (SQLite) + yahoo-finance2 + @google/genai
│   ├── prisma/
│   │   ├── schema.prisma     # Skema PortfolioRecord & MarketQuoteCache
│   │   └── seed.ts           # Script seed contoh referensi HRTA
│   ├── src/
│   │   ├── config/           # Pembacaan variabel lingkungan (.env)
│   │   ├── data/             # Daftar kurasi saham BEI/IDX & normalisasi simbol
│   │   ├── lib/              # Prisma client & error handler terpusat
│   │   ├── routes/           # Endpoint: docs, stocks, portfolio, ai
│   │   ├── services/         # Market data, portfolio CRUD/CSV, Gemini AI, rule-based fallback
│   │   └── validation/       # Skema validasi input berbasis Zod
│   └── .env.example          # Template konfigurasi server
├── shared/                   # Paket TypeScript murni (@portocalc/shared): rumus & unit test Vitest
├── docs/
│   ├── API_DOCUMENTATION.md  # Dokumentasi lengkap REST API (Bahasa Indonesia)
│   ├── openapi.yaml          # Spesifikasi OpenAPI 3.1.0
│   └── postman_collection.json
├── package.json
└── vitest.config.ts
```

---

## Cara Menjalankan Server API

Prasyarat: **Node.js ≥ 20**.

```bash
# 1. Salin file environment dan sesuaikan bila perlu
cp backend/.env.example backend/.env
# (Di PowerShell Windows: Copy-Item backend/.env.example backend/.env)

# 2. Install seluruh dependency & inisialisasi tabel SQLite
npm run setup

# 3. Jalankan server API dalam mode development (watch)
npm run dev
```

Setelah berjalan:
- **Root Info**: `http://localhost:4000/`
- **Interactive API Docs**: `http://localhost:4000/api/docs`
- **OpenAPI YAML**: `http://localhost:4000/api/openapi.yaml`
- **Health Check**: `http://localhost:4000/api/health`

### Konfigurasi `backend/.env`

| Variabel | Default | Keterangan |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port HTTP server |
| `DATABASE_URL` | `"file:./dev.db"` | Lokasi file SQLite relatif terhadap `backend/prisma/` |
| `GEMINI_API_KEY` | `""` | Kunci API Google AI Studio (kosongkan untuk mode *rule-based*) |
| `GEMINI_MODEL` | `"gemini-3.8-flash"` | Nama model Gemini yang dipanggil |
| `CORS_ORIGIN` | `"http://localhost:5173"` | Daftar origin frontend yang diizinkan (pisahkan dengan koma) |

---

## Ringkasan Cepat Endpoint

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Status server, SQLite, dan Gemini AI |
| `GET` | `/api/docs` | UI dokumentasi API interaktif |
| `GET` | `/api/openapi.yaml` | Spesifikasi OpenAPI 3.1 (YAML) |
| `GET` | `/api/stocks/list` | Daftar kurasi saham IDX + emas spot (`XAU-IDR`) |
| `GET` | `/api/stocks/search?q=` | Pencarian simbol saham BEI/IDX |
| `GET` | `/api/stocks/quote/:symbol` | Harga `BELI` (*ask*) & `JUAL` (*bid*) terkini |
| `GET` | `/api/stocks/history/:symbol?range=3m` | Riwayat penutupan harian (`1m`, `3m`, `6m`, `1y`) |
| `POST` | `/api/portfolio/calculate` | Kalkulasi instan + simulasi *what-if* |
| `GET` | `/api/portfolio` | Ambil daftar catatan portofolio (`?type=all\|actual\|simulation`) |
| `POST` | `/api/portfolio` | Buat catatan portofolio baru |
| `PUT` | `/api/portfolio/:id` | Perbarui catatan portofolio |
| `DELETE` | `/api/portfolio/:id` | Hapus catatan portofolio |
| `GET` | `/api/portfolio/export.csv` | Unduh catatan portofolio dalam format CSV |
| `POST` | `/api/portfolio/forecast` | Proyeksi perkembangan aset masa depan |
| `GET` | `/api/ai/status` | Cek status kesiapan Gemini AI |
| `POST` | `/api/ai/insight` | Minta analisis & saran investasi AI |

Detail lengkap *request body* dan contoh respons tersedia di **[`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)**.

---

## Pengujian & Pemeriksaan Tipe

```bash
# Jalankan unit test rumus kalkulasi & forecasting (Vitest)
npm test

# Cek tipe TypeScript di workspace shared & backend
npm run typecheck
```
