## 🏗️ Desain Arsitektur DMS PoC

### 📋 **Overview Sistem**

**DMS (Document Management System) PoC** adalah sistem manajemen dokumen berbasis microservices yang menggunakan arsitektur **containerized** dengan **Docker Compose**.

### 🎯 **Arsitektur High-Level**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client/User   │───▶│   DMS App       │───▶│   PostgreSQL    │
│  (Browser/API)  │    │  (Node.js/TS)   │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Elasticsearch  │    │     MinIO       │
                       │   (Search)      │    │ (File Storage)  │
                       └─────────────────┘    └─────────────────┘
```

### 🔧 **Komponen Utama**

#### **1. DMS Application (Node.js + TypeScript)**
- **Port:** 3000
- **Framework:** Express.js
- **Language:** TypeScript
- **Fungsi:** API Gateway, Business Logic, OCR Processing

**Key Features:**
- RESTful API endpoints
- File upload handling (Multer)
- OCR processing (Tesseract.js)
- Document text extraction (PDF, Word)
- CORS support

#### **2. PostgreSQL Database**
- **Port:** 5432
- **Version:** PostgreSQL 15
- **Fungsi:** Primary data storage

**Schema:**
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  original_name VARCHAR(255),
  file_path VARCHAR(255),
  s3_key VARCHAR(255),
  ocr_text TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### **3. Elasticsearch**
- **Port:** 9200
- **Version:** 8.11.0
- **Fungsi:** Full-text search engine

**Index Structure:**
```json
{
  "mappings": {
    "properties": {
      "filename": { "type": "text" },
      "original_name": { "type": "text" },
      "ocr_text": { "type": "text" },
      "mime_type": { "type": "keyword" },
      "file_size": { "type": "integer" },
      "created_at": { "type": "date" }
    }
  }
}
```

#### **4. MinIO (S3-Compatible Storage)**
- **Port:** 9000 (API), 9001 (Console)
- **Fungsi:** Object storage untuk file
- **Bucket:** `dms-documents`

### 🔄 **Data Flow Architecture**

#### **Upload Process:**
```
1. Client ──POST──▶ DMS App (/api/documents/upload)
2. DMS App ──────▶ Temporary Storage (uploads/)
3. DMS App ──────▶ OCR Processing (Tesseract)
4. DMS App ──────▶ MinIO (File Storage)
5. DMS App ──────▶ PostgreSQL (Metadata)
6. DMS App ──────▶ Elasticsearch (Indexing)
7. DMS App ──────▶ Client (Response)
```

#### **Search Process:**
```
1. Client ──GET───▶ DMS App (/api/documents/search?q=term)
2. DMS App ──────▶ Elasticsearch (Query)
3. Elasticsearch ▶ DMS App (Results)
4. DMS App ──────▶ Client (Search Results)
```

#### **Download Process:**
```
1. Client ──GET───▶ DMS App (/api/documents/:id/download)
2. DMS App ──────▶ PostgreSQL (Get metadata)
3. DMS App ──────▶ MinIO (Get file)
4. DMS App ──────▶ Client (File stream)
```

### 🐳 **Container Architecture**

#### **Docker Compose Services:**

1. **`dms-app`** (Application Container)
   - Base: `node:18-alpine`
   - Dependencies: Tesseract OCR
   - Volume mounts: source code, uploads

2. **`postgres`** (Database Container)
   - Image: `postgres:15`
   - Persistent volume: `postgres_data`

3. **`elasticsearch`** (Search Container)
   - Image: `elasticsearch:8.11.0`
   - Single-node setup
   - Persistent volume: `es_data`

4. **`minio`** (Storage Container)
   - Image: `minio/minio:latest`
   - Console + API ports
   - Persistent volume: `minio_data`

### 📡 **API Endpoints**

```typescript
// Core Endpoints
POST   /api/documents/upload     // Upload dokumen
GET    /api/documents/search     // Pencarian dokumen
GET    /api/documents           // List semua dokumen
GET    /api/documents/:id/download // Download dokumen
GET    /api/health              // Health check
GET    /                        // Web interface
```

### 🔍 **OCR & Text Processing**

#### **Supported File Types:**
- **Images:** PNG, JPG, GIF → Tesseract OCR
- **PDF:** PDF files → pdf-parse
- **Word:** DOCX files → mammoth
- **Text:** TXT, MD, CSV → direct read

#### **Processing Pipeline:**
```typescript
let ocrText = '';

if (file.mimetype.startsWith('image/')) {
  ocrText = await performOCR(file.path);        // Tesseract
} else if (file.mimetype === 'application/pdf') {
  ocrText = await extractPdfText(file.path);    // pdf-parse
} else if (file.mimetype.includes('wordprocessingml')) {
  ocrText = await extractWordText(file.path);   // mammoth
} else if (file.mimetype.startsWith('text/')) {
  ocrText = fs.readFileSync(file.path, 'utf8'); // direct
}
```

### 🔐 **Security & Configuration**

#### **Environment Variables:**
```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=dms_db
DB_USER=dms_user
DB_PASSWORD=dms_password

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200

# MinIO/S3
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=dms-documents
```

### 📊 **Data Persistence**

#### **Docker Volumes:**
- `postgres_data` → Database files
- `es_data` → Elasticsearch indices
- `minio_data` → Object storage files
- `./uploads` → Temporary upload directory

### 🚀 **Deployment Strategy**

#### **Development:**
```bash
docker-compose up --build
```

#### **Production Considerations:**
- **Load Balancer** untuk DMS App
- **Database Clustering** untuk PostgreSQL
- **Elasticsearch Cluster** untuk high availability
- **CDN** untuk MinIO static files
- **SSL/TLS** termination
- **Monitoring** (Prometheus, Grafana)
- **Logging** (ELK Stack)

### 💡 **Keunggulan Arsitektur:**

✅ **Microservices** - Setiap komponen independen
✅ **Scalable** - Dapat di-scale per service
✅ **Containerized** - Consistent deployment
✅ **Full-text Search** - Elasticsearch integration
✅ **Object Storage** - S3-compatible MinIO
✅ **OCR Support** - Multi-format text extraction
✅ **RESTful API** - Standard HTTP interface
✅ **TypeScript** - Type safety

### 🎯 **Use Cases:**

1. **Document Upload & Storage**
2. **Full-text Search** across documents
3. **OCR Processing** for images
4. **Metadata Management**
5. **File Download & Streaming**
6. **API Integration** dengan sistem lain

Arsitektur ini dirancang untuk **scalability**, **maintainability**, dan **extensibility** dengan menggunakan best practices modern development! 🌟
        