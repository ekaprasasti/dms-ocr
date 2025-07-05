# Data Management System (DMS) PoC

PoC sederhana untuk Data Management System yang mengintegrasikan NodeJS, TypeScript, Elasticsearch, OCR, S3 (MinIO), dan PostgreSQL menggunakan Docker.

## Teknologi yang Digunakan

- **NodeJS + TypeScript**: Backend API server
- **PostgreSQL**: Database untuk metadata dokumen
- **Elasticsearch**: Search engine untuk pencarian dokumen
- **MinIO (S3)**: Object storage untuk file dokumen
- **Tesseract OCR**: Ekstraksi teks dari gambar
- **Docker**: Containerization semua services

## Struktur Project

```
dms-step-by-step/
├── docker-compose.yml    # Konfigurasi semua services
├── Dockerfile           # Container untuk aplikasi NodeJS
├── package.json         # Dependencies NodeJS
├── tsconfig.json        # Konfigurasi TypeScript
├── src/
│   └── index.ts         # Aplikasi utama DMS
└── README.md           # Dokumentasi ini
```

## Cara Menjalankan

1. **Clone atau buat project ini**
   ```bash
   cd /Users/ekaprasasti/Documents/PoC/dms-step-by-step
   ```

2. **Jalankan semua services dengan Docker Compose**
   ```bash
   docker-compose up --build
   ```

3. **Tunggu hingga semua services running** (sekitar 1-2 menit)
   - PostgreSQL: `localhost:5432`
   - Elasticsearch: `localhost:9200`
   - MinIO: `localhost:9000` (Console: `localhost:9001`)
   - DMS App: `localhost:3000`

4. **Akses aplikasi**
   - Web Interface: http://localhost:3000
   - API Health Check: http://localhost:3000/api/health

## Fitur Utama

### 1. Upload Dokumen
- Upload file melalui web interface atau API
- Otomatis melakukan OCR untuk file gambar
- Menyimpan file ke MinIO (S3)
- Menyimpan metadata ke PostgreSQL
- Mengindex konten ke Elasticsearch

### 2. Pencarian Dokumen
- Pencarian berdasarkan nama file, nama asli, atau hasil OCR
- Menggunakan Elasticsearch untuk pencarian yang cepat
- Support full-text search

### 3. Download Dokumen
- Download file langsung dari S3 storage
- Preservasi nama file asli

### 4. Manajemen Dokumen
- List semua dokumen dengan metadata
- Informasi ukuran file, tipe MIME, tanggal upload

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|----------|
| GET | `/` | Web interface |
| POST | `/api/documents/upload` | Upload dokumen |
| GET | `/api/documents/search?q=query` | Pencarian dokumen |
| GET | `/api/documents` | List semua dokumen |
| GET | `/api/documents/:id/download` | Download dokumen |
| GET | `/api/health` | Health check semua services |

## Contoh Penggunaan

### Upload Dokumen via API
```bash
curl -X POST -F "document=@example.jpg" http://localhost:3000/api/documents/upload
```

### Pencarian Dokumen
```bash
curl "http://localhost:3000/api/documents/search?q=invoice"
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

## Akses Services Individual

- **MinIO Console**: http://localhost:9001
  - Username: `minioadmin`
  - Password: `minioadmin123`

- **Elasticsearch**: http://localhost:9200
  - Index: `documents`

- **PostgreSQL**: 
  - Host: `localhost:5432`
  - Database: `dms_db`
  - User: `dms_user`
  - Password: `dms_password`

## Cara Kerja Integrasi

1. **Upload Flow**:
   - File diterima via Express.js dengan Multer
   - File disimpan ke MinIO (S3 compatible)
   - Jika file gambar, dilakukan OCR dengan Tesseract
   - Metadata disimpan ke PostgreSQL
   - Dokumen diindex ke Elasticsearch

2. **Search Flow**:
   - Query diterima via API
   - Elasticsearch melakukan pencarian di index `documents`
   - Hasil dikembalikan dengan scoring relevance

3. **Download Flow**:
   - Metadata diambil dari PostgreSQL
   - File diambil dari MinIO
   - File dikirim ke client dengan header yang sesuai

## Stopping Services

```bash
docker-compose down
```

Untuk menghapus volumes (data akan hilang):
```bash
docker-compose down -v
```