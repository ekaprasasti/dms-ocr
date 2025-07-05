# API Reference - DMS PoC

## Quick Start

**Base URL:** `http://localhost:3000`

## API Endpoints

### 🏥 Health Check
```http
GET /api/health
```
Cek status aplikasi dan koneksi layanan.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "elasticsearch": "connected", 
    "minio": "connected"
  }
}
```

### 📤 Upload Document
```http
POST /api/upload
Content-Type: multipart/form-data
```

**Parameters:**
- `document` (file) - File dokumen *required*
- `title` (string) - Judul dokumen *optional*
- `description` (string) - Deskripsi *optional*

**Example:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "document=@file.pdf" \
  -F "title=Kontrak Kerja" \
  -F "description=Dokumen kontrak karyawan"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "filename": "file.pdf",
    "title": "Kontrak Kerja",
    "size": 1024576,
    "ocr_text": "Extracted text...",
    "uploaded_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 🔍 Search Documents
```http
GET /api/search?q={query}&limit={limit}&offset={offset}
```

**Parameters:**
- `q` (string) - Query pencarian *required*
- `limit` (number) - Jumlah hasil (default: 10)
- `offset` (number) - Offset pagination (default: 0)

**Example:**
```bash
curl "http://localhost:3000/api/search?q=kontrak&limit=5"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "documents": [
      {
        "id": "uuid-here",
        "filename": "kontrak.pdf",
        "title": "Kontrak Kerja",
        "score": 1.5,
        "highlight": {
          "title": ["<em>Kontrak</em> Kerja"]
        }
      }
    ]
  }
}
```

### 📋 List All Documents
```http
GET /api/documents?limit={limit}&offset={offset}
```

**Parameters:**
- `limit` (number) - Jumlah hasil (default: 10)
- `offset` (number) - Offset pagination (default: 0)

**Example:**
```bash
curl "http://localhost:3000/api/documents?limit=20"
```

### 📥 Download Document
```http
GET /api/download/{id}
```

**Example:**
```bash
curl -O -J "http://localhost:3000/api/download/uuid-here"
```

### 🌐 Web Interface
```http
GET /
```
Antarmuka web untuk upload, search, dan download dokumen.

## Status Codes

| Code | Description |
|------|-------------|
| 200  | ✅ Success |
| 400  | ❌ Bad Request |
| 404  | ❌ Not Found |
| 500  | ❌ Server Error |

## Supported File Types

- **Documents:** PDF, DOC, DOCX, TXT
- **Images:** JPG, JPEG, PNG, GIF
- **Max Size:** 10MB

## Features

- ✅ **OCR Otomatis** - Ekstraksi teks dari gambar/PDF
- ✅ **Full-text Search** - Pencarian dalam konten dokumen
- ✅ **Metadata Storage** - PostgreSQL untuk metadata
- ✅ **Object Storage** - MinIO untuk file storage
- ✅ **Search Engine** - Elasticsearch untuk pencarian

## JavaScript Example

```javascript
// Upload
const formData = new FormData();
formData.append('document', file);
formData.append('title', 'My Document');

fetch('/api/upload', {
  method: 'POST',
  body: formData
}).then(res => res.json());

// Search
fetch(`/api/search?q=${query}`)
  .then(res => res.json())
  .then(data => {
    data.data.documents.forEach(doc => {
      console.log(doc.title);
    });
  });
```

## Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build & start
npm run build && npm start

# Docker
docker-compose up --build
```