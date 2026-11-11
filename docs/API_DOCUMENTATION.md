# Dokumentasi REST API — NgeTarget Saham (PortoCalc AI)

Dokumentasi lengkap layanan backend **NgeTarget Saham API** untuk kalkulasi portofolio investasi, simulasi *what-if* ("angan-angan"), pengambilan data pasar saham Bursa Efek Indonesia (BEI/IDX) & emas spot dunia, model *forecasting*, serta asisten analisis berbasis **Google Gemini AI**.

- **Repositori Utama (Fullstack)**: [rahalsaabiumara/NgeTarget-saham](https://github.com/rahalsaabiumara/NgeTarget-saham)
- **Repositori API & Dokumentasi**: [rahalsaabiumara/NgeTarget-saham-API](https://github.com/rahalsaabiumara/NgeTarget-saham-API)
- **Spesifikasi OpenAPI 3.1**: [`docs/openapi.yaml`](openapi.yaml)
- **Koleksi Postman v2.1**: [`docs/postman_collection.json`](postman_collection.json)

---

## Daftar Isi

1. [Informasi Dasar & Konfigurasi](#1-informasi-dasar--konfigurasi)
2. [Standar Respons & Penanganan Error](#2-standar-respons--penanganan-error)
3. [Ringkasan Seluruh Endpoint](#3-ringkasan-seluruh-endpoint)
4. [Detail Endpoint: System & Dokumentasi](#4-detail-endpoint-system--dokumentasi)
5. [Detail Endpoint: Market Data (Saham IDX & Emas)](#5-detail-endpoint-market-data-saham-idx--emas)
6. [Detail Endpoint: Kalkulasi & CRUD Portofolio](#6-detail-endpoint-kalkulasi--crud-portofolio)
7. [Detail Endpoint: Forecasting](#7-detail-endpoint-forecasting)
8. [Detail Endpoint: Gemini AI Advisor](#8-detail-endpoint-gemini-ai-advisor)
9. [Referensi Rumus Matematika](#9-referensi-rumus-matematika)

---

## 1. Informasi Dasar & Konfigurasi

| Parameter | Nilai Default | Keterangan |
| :--- | :--- | :--- |
| **Base URL** | `http://localhost:4000` | Dapat diubah melalui variabel `PORT` di `.env` |
| **Prefix API** | `/api` | Seluruh endpoint data berada di bawah `/api/*` |
| **Interactive Docs** | `http://localhost:4000/api/docs` | UI dokumentasi interaktif berbasis OpenAPI 3.1 |
| **Content-Type** | `application/json` | Kecuali `/api/portfolio/export.csv` (`text/csv`) |
| **Batas Payload JSON** | `100kb` | Dibatasi pada middleware Express |
| **Database** | SQLite (`Prisma ORM`) | Lokasi default: `backend/prisma/dev.db` |

### Keamanan API Key
Kunci `GEMINI_API_KEY` **hanya** dibaca di sisi server melalui `backend/.env` dan tidak pernah dikirim ataupun diminta dari sisi *client*. Apabila `GEMINI_API_KEY` dikosongkan, endpoint `/api/ai/insight` tetap merespons `200 OK` menggunakan mesin analisis berbasis aturan (*rule-based fallback*).

---

## 2. Standar Respons & Penanganan Error

Seluruh error dikembalikan secara konsisten dalam format JSON:

```json
{
  "error": "Input tidak valid.",
  "details": [
    {
      "field": "buyPrice",
      "message": "Harga BELI harus lebih besar dari 0."
    }
  ]
}
```

| Kode HTTP | Arti | Contoh Kondisi |
| :--- | :--- | :--- |
| `200 OK` | Permintaan berhasil diproses | Ambil daftar data, kalkulasi, proyeksi, atau update |
| `201 Created` | Data baru berhasil disimpan | `POST /api/portfolio` |
| `204 No Content` | Data berhasil dihapus | `DELETE /api/portfolio/:id` |
| `400 Bad Request` | Validasi input gagal (`ZodError` / `CalculationError`) | Nilai `buyPrice <= 0` atau tanggal bukan `YYYY-MM-DD` |
| `404 Not Found` | Endpoint atau data tidak ditemukan | ID portofolio tidak ada di SQLite atau simbol saham tidak valid |
| `502 Bad Gateway` | Penyedia data eksternal gagal & cache lokal belum tersedia | Koneksi ke Yahoo Finance terputus untuk simbol baru |
| `500 Internal Server Error` | Kesalahan tak terduga di sisi server | Gangguan sistem file/database |

---

## 3. Ringkasan Seluruh Endpoint

| Kategori | Method | Path | Deskripsi Singkat |
| :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/health` | Status server, koneksi SQLite, dan konfigurasi Gemini AI |
| **System** | `GET` | `/api/docs` | Halaman dokumentasi API interaktif (Scalar UI) |
| **System** | `GET` | `/api/openapi.yaml` | Spesifikasi mentah OpenAPI 3.1.0 dalam format YAML |
| **Market Data** | `GET` | `/api/stocks/list` | Daftar kurasi 26 saham populer BEI/IDX + emas spot (`XAU-IDR`) |
| **Market Data** | `GET` | `/api/stocks/search?q=` | Pencarian simbol saham BEI/IDX |
| **Market Data** | `GET` | `/api/stocks/quote/:symbol` | Harga terbaru (`buyPrice` / ask, `sellPrice` / bid, `lastPrice`) |
| **Market Data** | `GET` | `/api/stocks/history/:symbol` | Harga penutupan harian (`1m`, `3m`, `6m`, `1y`) |
| **Portfolio** | `POST` | `/api/portfolio/calculate` | Kalkulasi instan metrik spreadsheet + simulasi *what-if* |
| **Portfolio** | `GET` | `/api/portfolio` | Daftar catatan portofolio tersimpan (`all` / `actual` / `simulation`) |
| **Portfolio** | `POST` | `/api/portfolio` | Simpan catatan portofolio baru ke SQLite |
| **Portfolio** | `PUT` | `/api/portfolio/:id` | Perbarui catatan portofolio berdasarkan UUID |
| **Portfolio** | `DELETE` | `/api/portfolio/:id` | Hapus catatan portofolio berdasarkan UUID |
| **Portfolio** | `GET` | `/api/portfolio/export.csv` | Unduh seluruh catatan sebagai file CSV (kompatibel Excel) |
| **Forecasting** | `POST` | `/api/portfolio/forecast` | Proyeksi perkembangan aset 1–60 bulan (Bull, Base, Bear) |
| **AI Advisor** | `GET` | `/api/ai/status` | Cek ketersediaan `GEMINI_API_KEY` dan model aktif |
| **AI Advisor** | `POST` | `/api/ai/insight` | Analisis portofolio & rekomendasi strategis dari Gemini AI |

---

## 4. Detail Endpoint: System & Dokumentasi

### `GET /api/health`
Memeriksa kesehatan proses API, ketersediaan koneksi SQLite (`SELECT 1`), dan status konfigurasi Gemini AI.

**Contoh Request:**
```bash
curl http://localhost:4000/api/health
```

**Contoh Respons (`200 OK`):**
```json
{
  "status": "ok",
  "database": true,
  "geminiConfigured": true,
  "geminiModel": "gemini-3.8-flash",
  "time": "2026-11-11T01:45:00.000Z"
}
```

---

## 5. Detail Endpoint: Market Data (Saham IDX & Emas)

### 5.1. `GET /api/stocks/list`
Mengembalikan daftar kurasi saham unggulan BEI/IDX (berakhiran `.JK`) beserta simbol khusus **`XAU-IDR`** (harga emas spot dunia dalam Rupiah per gram: `GC=F × USDIDR ÷ 31,1034768`).

**Contoh Respons (`200 OK`):**
```json
[
  {
    "symbol": "HRTA.JK",
    "name": "Hartadinata Abadi Tbk",
    "sector": "Emas & Perhiasan",
    "category": "saham"
  },
  {
    "symbol": "BBCA.JK",
    "name": "Bank Central Asia Tbk",
    "sector": "Perbankan",
    "category": "saham"
  },
  {
    "symbol": "XAU-IDR",
    "name": "Emas Spot Dunia (Rp per gram)",
    "sector": "Komoditas Emas",
    "category": "emas"
  }
]
```

### 5.2. `GET /api/stocks/search?q={query}`
Mencari emiten saham BEI berdasarkan kode ticker atau nama perusahaan (minimal 2 karakter), menggabungkan daftar lokal dengan pencarian *live* Yahoo Finance khusus akhiran `.JK`.

```bash
curl "http://localhost:4000/api/stocks/search?q=tambang"
```

### 5.3. `GET /api/stocks/quote/:symbol`
Mengambil kuotasi harga terbaru. Kode 4 huruf tanpa akhiran (mis. `HRTA`, `BBCA`, `ANTM`) otomatis dinormalisasi menjadi `.JK` (`HRTA.JK`).
- Cache memori aktif selama **60 detik**.
- Setiap pengambilan *live* yang berhasil disimpan ke tabel `MarketQuoteCache` di SQLite sebagai cadangan otomatis (`source: "cache"`) apabila suatu saat koneksi ke Yahoo Finance gagal.

```bash
curl http://localhost:4000/api/stocks/quote/HRTA.JK
```

**Contoh Respons (`200 OK`):**
```json
{
  "symbol": "HRTA.JK",
  "name": "PT Hartadinata Abadi Tbk",
  "currency": "IDR",
  "buyPrice": 1415,
  "sellPrice": 1410,
  "lastPrice": 1415,
  "changePct": 5.597015,
  "marketState": "REGULAR",
  "source": "live",
  "priceBasis": "BELI = ask (offer), JUAL = bid — harga per lembar",
  "fetchedAt": "2026-11-11T01:45:00.000Z"
}
```

### 5.4. `GET /api/stocks/history/:symbol?range=3m`
Mengambil deret harga penutupan harian (*daily close*) dari terlama ke terbaru.
- **Query Parameter `range`**: `1m` (31 hari), `3m` (92 hari, *default*), `6m` (183 hari), atau `1y` (366 hari).
- Cache memori aktif selama **30 menit**.

```bash
curl "http://localhost:4000/api/stocks/history/XAU-IDR?range=1y"
```

**Contoh Respons (`200 OK`):**
```json
[
  { "date": "2025-11-11", "close": 2115420 },
  { "date": "2025-11-12", "close": 2120880 },
  { "date": "2026-11-09", "close": 2389741 }
]
```

---

## 6. Detail Endpoint: Kalkulasi & CRUD Portofolio

### 6.1. `POST /api/portfolio/calculate`
Menghitung seluruh kolom spreadsheet secara instan **tanpa menyimpan ke database**, mendukung mode input nilai aset manual maupun otomatis serta simulasi *what-if*.

**Parameter Body JSON:**

| Field | Tipe | Wajib | Default | Keterangan |
| :--- | :--- | :---: | :---: | :--- |
| `buyPrice` | `number` | Ya | — | Harga `BELI` per unit ($> 0$) |
| `sellPrice` | `number` | Ya | — | Harga `JUAL` / *buyback* per unit ($\ge 0$) |
| `initialCapital` | `number` | Ya | — | `MODAL AWAL` dalam Rupiah ($> 0$) |
| `currentAssetValue` | `number \| null` | Kondisional | — | Wajib diisi apabila `assetValueMode = "manual"` |
| `assetValueMode` | `"manual" \| "auto"` | Tidak | `"manual"` | `"auto"` menghitung aset dari `units * sellPrice` atau `initialCapital * (sellPrice / buyPrice)` |
| `units` | `number \| null` | Tidak | `null` | Jumlah lembar/gram pada mode `"auto"` |
| `targetPct` | `number` | Tidak | `10` | Target persentase keuntungan (`-100` s/d `10000`) |
| `whatIf.priceChangePct` | `number` | Tidak | `0` | Simulasi perubahan harga `JUAL` dalam persen |
| `whatIf.additionalCapital` | `number` | Tidak | `0` | Simulasi tambahan modal yang dibelikan di harga `BELI` |

**Contoh Request (Kasus Referensi Spreadsheet HRTA):**
```bash
curl -X POST http://localhost:4000/api/portfolio/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "buyPrice": 2455000,
    "sellPrice": 2375000,
    "initialCapital": 2100000,
    "currentAssetValue": 2072900,
    "targetPct": 10,
    "assetValueMode": "manual",
    "whatIf": {
      "priceChangePct": 12,
      "additionalCapital": 0
    }
  }'
```

**Contoh Respons (`200 OK`):**
```json
{
  "result": {
    "buyPrice": 2455000,
    "sellPrice": 2375000,
    "spreadLossPct": 3.26,
    "currentAssetValue": 2072900,
    "initialCapital": 2100000,
    "profitLossNominal": -27100,
    "profitLossPct": -1.29,
    "targetPct": 10,
    "targetAssetValue": 2310000,
    "shortfallToTarget": 237100,
    "isTargetMet": false,
    "targetStatusLabel": "Belum Tercapai",
    "breakEvenSellPrice": 2406049.5,
    "requiredSellPriceForTarget": 2646654.45,
    "requiredPriceChangePct": 11.44
  },
  "whatIf": {
    "buyPrice": 2455000,
    "sellPrice": 2660000,
    "spreadLossPct": -8.35,
    "currentAssetValue": 2321648,
    "initialCapital": 2100000,
    "profitLossNominal": 221648,
    "profitLossPct": 10.55,
    "targetPct": 10,
    "targetAssetValue": 2310000,
    "shortfallToTarget": 0,
    "isTargetMet": true,
    "targetStatusLabel": "Tercapai",
    "breakEvenSellPrice": 2406049.5,
    "requiredSellPriceForTarget": 2646654.45,
    "requiredPriceChangePct": -0.5
  }
}
```

### 6.2. `GET /api/portfolio`
Mengambil daftar catatan portofolio dari SQLite, diurutkan dari `recordDate` terbaru. Saat server pertama kali dijalankan pada database kosong, baris contoh `HRTA` di-*seed* secara otomatis.
- **Query Parameter `type`**: `all` (*default*), `actual`, atau `simulation`.

### 6.3. `POST /api/portfolio`
Menyimpan catatan portofolio baru ke SQLite. Seluruh metrik hasil kalkulasi dihitung ulang di sisi server untuk menjamin integritas data.

```bash
curl -X POST http://localhost:4000/api/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BBCA.JK",
    "assetName": "Bank Central Asia Tbk",
    "buyPrice": 10200,
    "sellPrice": 10175,
    "initialCapital": 5100000,
    "units": 500,
    "assetValueMode": "auto",
    "targetPct": 10,
    "recordDate": "2026-11-11",
    "isSimulation": false,
    "notes": "Akumulasi 5 lot"
  }'
```

### 6.4. `PUT /api/portfolio/:id` & `DELETE /api/portfolio/:id`
- `PUT /api/portfolio/:id`: Memperbarui catatan yang ada dan otomatis mengosongkan *cache* insight AI lama karena angka portofolio telah berubah. Mengembalikan `200 OK` beserta objek `PortfolioRecord` terbaru, atau `404 Not Found` bila ID tidak ditemukan.
- `DELETE /api/portfolio/:id`: Menghapus catatan dari SQLite dan mengembalikan `204 No Content`.

### 6.5. `GET /api/portfolio/export.csv`
Mengunduh data portofolio dalam format CSV ber-header:
`SAHAM/ASET,NAMA,BELI,JUAL,%RUGI,TANGGAL,ASET SAAT INI,MODAL AWAL,L/R,%L/R,TARGET %,STATUS TARGET,JENIS,CATATAN`
Diawali karakter UTF-8 BOM (`\uFEFF`) agar langsung terbaca rapi di Microsoft Excel.

---

## 7. Detail Endpoint: Forecasting

### `POST /api/portfolio/forecast`
Memproyeksikan nilai aset bulanan (`month: 0` hingga `months`) dalam 3 skenario:
- `base`: Skenario Moderat
- `bull`: Skenario Optimis ($+0.5 \cdot \sigma \sqrt{t}$)
- `bear`: Skenario Pesimis ($-0.5 \cdot \sigma \sqrt{t}$)

Apabila `method = "historical"` dipilih namun data historis simbol kurang dari 20 hari bursa atau gagal diambil, endpoint secara aman beralih ke metode `"assumption"` dan menyertakan penjelasannya pada field `notice`.

**Contoh Request:**
```bash
curl -X POST http://localhost:4000/api/portfolio/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "currentAssetValue": 2072900,
    "initialCapital": 2100000,
    "targetPct": 10,
    "months": 12,
    "monthlyContribution": 100000,
    "method": "historical",
    "symbol": "XAU-IDR",
    "historyRange": "1y"
  }'
```

**Contoh Respons (`200 OK`, diringkas):**
```json
{
  "method": "historical",
  "sampleSize": 250,
  "dailyDrift": 0.000483,
  "dailyVolatility": 0.01808,
  "annualizedReturnPct": 12.95,
  "annualizedVolatilityPct": 28.7,
  "rawAnnualizedReturnPct": 12.95,
  "points": [
    {
      "month": 0,
      "date": "2026-11-11",
      "invested": 2100000,
      "targetValue": 2310000,
      "base": 2072900,
      "bull": 2072900,
      "bear": 2072900
    },
    {
      "month": 12,
      "date": "2027-11-11",
      "invested": 3300000,
      "targetValue": 3630000,
      "base": 3618420.15,
      "bull": 4137950.4,
      "bear": 3098889.9
    }
  ],
  "targetHitMonth": {
    "base": null,
    "bull": 5,
    "bear": null
  }
}
```

---

## 8. Detail Endpoint: Gemini AI Advisor

### 8.1. `GET /api/ai/status`
Mengembalikan status kesiapan kunci Gemini AI di server tanpa mengekspos nilai kunci:
```json
{
  "geminiConfigured": true,
  "model": "gemini-3.8-flash"
}
```

### 8.2. `POST /api/ai/insight`
Menghasilkan evaluasi posisi portofolio terstruktur dalam Bahasa Indonesia.
- Menyertakan `recordId` akan mengaktifkan **caching SHA-256 di SQLite** sehingga permintaan berulang dengan parameter yang sama tidak memakan kuota API Gemini (gunakan `"force": true` untuk memaksa pembuatan ulang).

**Contoh Request:**
```bash
curl -X POST http://localhost:4000/api/ai/insight \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "HRTA",
    "assetName": "Emas HRTA (Hartadinata)",
    "recordDate": "2026-11-09",
    "buyPrice": 2455000,
    "sellPrice": 2375000,
    "initialCapital": 2100000,
    "currentAssetValue": 2072900,
    "targetPct": 10,
    "assetValueMode": "manual",
    "force": false
  }'
```

**Contoh Respons (`200 OK`):**
```json
{
  "insight": {
    "summary": "Posisi Emas HRTA (HRTA) saat ini floating loss Rp 27.100 (-1,29%) dari modal Rp 2.100.000. Nilai aset Rp 2.072.900 masih berada tipis di bawah modal awal.",
    "spreadAnalysis": "Spread beli–jual sebesar 3,26% tergolong lebar (khas emas fisik/buyback), sehingga instrumen ini lebih optimal untuk horizon menengah hingga panjang.",
    "targetStrategy": "Target 10% belum tercapai. Dibutuhkan nilai aset Rp 2.310.000 (kurang Rp 237.100) atau kenaikan harga JUAL ke sekitar Rp 2.646.654 (+11,44%).",
    "recommendations": [
      {
        "title": "Hold & pantau titik impas",
        "detail": "Pertahankan posisi dan jadikan level harga JUAL Rp 2.406.050 sebagai acuan impas sebelum mempertimbangkan realisasi."
      },
      {
        "title": "Gunakan DCA terukur",
        "detail": "Jika ingin menambah muatan, perhitungkan beban spread 3,26% pada setiap pembelian baru."
      }
    ],
    "riskLevel": "sedang",
    "disclaimer": "Analisis ini bersifat edukatif dan simulatif, bukan rekomendasi beli/jual. Keputusan investasi sepenuhnya tanggung jawab Anda."
  },
  "source": "gemini",
  "model": "gemini-3.8-flash",
  "cached": false,
  "generatedAt": "2026-11-11T01:46:00.000Z"
}
```

---

## 9. Referensi Rumus Matematika

1. **Persentase Rugi Spread (`spreadLossPct`)**:
   $$\text{\%RUGI} = \frac{\text{BELI} - \text{JUAL}}{\text{BELI}} \times 100\%$$
2. **Laba / Rugi Nominal (`profitLossNominal`)**:
   $$\text{L/R} = \text{ASET SAAT INI} - \text{MODAL AWAL}$$
3. **Persentase Laba / Rugi (`profitLossPct`)**:
   $$\text{\%L/R} = \frac{\text{L/R}}{\text{MODAL AWAL}} \times 100\%$$
4. **Harga Jual Impas (`breakEvenSellPrice`)**:
   $$\text{JUAL}_{\text{impas}} = \text{JUAL} \times \frac{\text{MODAL AWAL}}{\text{ASET SAAT INI}}$$
5. **Harga Jual Target (`requiredSellPriceForTarget`)**:
   $$\text{JUAL}_{\text{target}} = \text{JUAL} \times \frac{\text{MODAL AWAL} \times (1 + \text{TARGET\%} / 100)}{\text{ASET SAAT INI}}$$
6. **Forecasting Bulanan ($t = 21 \times m$ hari bursa, 252 hari bursa/tahun)**:
   - Return tahunan historis di-*clamp* pada rentang $[-60\%, +80\%]$ untuk mencegah distorsi *outlier* jangka pendek.
   - $V_{\text{base}}(m) = \text{ASET} \times (1 + r)^t + \text{Akumulasi DCA}$
   - $V_{\text{bull}}(m) = V_{\text{base}}(m) \times (1 + 0.5 \cdot \sigma \sqrt{t})$
   - $V_{\text{bear}}(m) = \max\big(0,\; V_{\text{base}}(m) \times (1 - 0.5 \cdot \sigma \sqrt{t})\big)$
