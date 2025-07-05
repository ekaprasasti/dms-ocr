# API Documentation - Data Management System PoC

## Base URL
```
http://localhost:3000
```

## Endpoints

### 1. Health Check
**GET** `/api/health`

Memeriksa status kesehatan aplikasi dan koneksi ke semua layanan.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "elasticsearch": "connected",
    "minio": "connected"
  }
}
```

### 2. Upload Document
**POST** `/api/upload`

Mengunggah dokumen dengan OCR otomatis dan penyimpanan ke database, Elasticsearch, dan MinIO.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `document` (file, required): File dokumen yang akan diunggah
- `title` (string, optional): Judul dokumen
- `description` (string, optional): Deskripsi dokumen

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "document=@/path/to/file.pdf" \
  -F "title=Contoh Dokumen" \
  -F "description=Ini adalah contoh dokumen"
```

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "filename": "file.pdf",
    "title": "Contoh Dokumen",
    "description": "Ini adalah contoh dokumen",
    "size": 1024576,
    "mimetype": "application/pdf",
    "s3_key": "documents/123e4567-e89b-12d3-a456-426614174000_file.pdf",
    "ocr_text": "Extracted text from document...",
    "uploaded_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

### 3. Search Documents
**GET** `/api/search`

Mencari dokumen berdasarkan query menggunakan Elasticsearch.

**Query Parameters:**
- `q` (string, required): Query pencarian
- `limit` (number, optional): Jumlah hasil maksimal (default: 10)
- `offset` (number, optional): Offset untuk pagination (default: 0)

**Example Request:**
```bash
curl "http://localhost:3000/api/search?q=kontrak&limit=5&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "documents": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "filename": "kontrak.pdf",
        "title": "Kontrak Kerja",
        "description": "Kontrak kerja karyawan",
        "size": 1024576,
        "mimetype": "application/pdf",
        "uploaded_at": "2024-01-01T00:00:00.000Z",
        "score": 1.5,
        "highlight": {
          "ocr_text": ["...kontrak kerja..."],
          "title": ["<em>Kontrak</em> Kerja"]
        }
      }
    ]
  }
}
```

### 4. Get All Documents
**GET** `/api/documents`

Mendapatkan daftar semua dokumen dengan pagination.

**Query Parameters:**
- `limit` (number, optional): Jumlah hasil maksimal (default: 10)
- `offset` (number, optional): Offset untuk pagination (default: 0)

**Example Request:**
```bash
curl "http://localhost:3000/api/documents?limit=20&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "documents": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "filename": "document.pdf",
        "title": "Sample Document",
        "description": "This is a sample document",
        "size": 1024576,
        "mimetype": "application/pdf",
        "uploaded_at": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 5. Download Document
**GET** `/api/download/:id`

Mengunduh dokumen berdasarkan ID.

**Path Parameters:**
- `id` (string, required): ID dokumen

**Example Request:**
```bash
curl -O -J "http://localhost:3000/api/download/123e4567-e89b-12d3-a456-426614174000"
```

**Response:**
- **Success**: File binary dengan header `Content-Disposition` untuk download
- **Error**: JSON error response

```json
{
  "success": false,
  "message": "Document not found"
}
```

### 6. Web Interface
**GET** `/`

Menampilkan antarmuka web sederhana untuk interaksi dengan sistem.

**Response:** HTML page dengan fitur:
- Form upload dokumen
- Form pencarian
- Daftar dokumen
- Fungsi download

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request - Parameter tidak valid |
| 404 | Not Found - Resource tidak ditemukan |
| 500 | Internal Server Error - Error server |

## Data Types

### Document Object
```typescript
interface Document {
  id: string;           // UUID dokumen
  filename: string;     // Nama file asli
  title?: string;       // Judul dokumen (opsional)
  description?: string; // Deskripsi dokumen (opsional)
  size: number;         // Ukuran file dalam bytes
  mimetype: string;     // MIME type file
  s3_key: string;       // Key untuk akses di MinIO/S3
  ocr_text?: string;    // Teks hasil OCR (opsional)
  uploaded_at: string;  // Timestamp upload (ISO 8601)
}
```

### Search Result Object
```typescript
interface SearchResult extends Document {
  score: number;        // Relevance score dari Elasticsearch
  highlight?: {         // Highlighted text dari pencarian
    [field: string]: string[];
  };
}
```

## Rate Limiting

Saat ini tidak ada rate limiting yang diimplementasikan. Untuk production, disarankan untuk menambahkan rate limiting.

## Authentication

Saat ini tidak ada autentikasi yang diimplementasikan. Ini adalah PoC untuk demonstrasi. Untuk production, implementasikan autentikasi yang sesuai.

## File Support

### Supported File Types
- PDF (`.pdf`)
- Images: JPEG (`.jpg`, `.jpeg`), PNG (`.png`), GIF (`.gif`)
- Documents: DOC (`.doc`), DOCX (`.docx`)
- Text files: TXT (`.txt`)

### File Size Limits
- Maximum file size: 10MB (dapat dikonfigurasi)

## OCR Capabilities

- Menggunakan Tesseract.js untuk ekstraksi teks
- Mendukung berbagai bahasa (default: English)
- Otomatis memproses gambar dan PDF
- Hasil OCR disimpan di database dan diindeks di Elasticsearch

## Examples

### Upload dan Search Workflow

1. **Upload dokumen:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "document=@contract.pdf" \
  -F "title=Employment Contract" \
  -F "description=Employee contract document"
```

2. **Cari dokumen:**
```bash
curl "http://localhost:3000/api/search?q=employment"
```

3. **Download dokumen:**
```bash
curl -O -J "http://localhost:3000/api/download/[document-id]"
```

### JavaScript/Frontend Integration

```javascript
// Upload file
const formData = new FormData();
formData.append('document', fileInput.files[0]);
formData.append('title', 'Document Title');

fetch('/api/upload', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));

// Search documents
fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
.then(response => response.json())
.then(data => {
  data.data.documents.forEach(doc => {
    console.log(doc.title, doc.filename);
  });
});
```

## Development

### Local Development
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Docker Development
```bash
# Start all services
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f dms-app
```