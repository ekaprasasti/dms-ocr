import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { Pool } from 'pg';
import { Client } from '@elastic/elasticsearch';
import AWS from 'aws-sdk';
import Tesseract from 'tesseract.js';
import fs from 'fs';

import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dms_db',
  user: process.env.DB_USER || 'dms_user',
  password: process.env.DB_PASSWORD || 'dms_password',
});

// Elasticsearch client
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

// S3 (MinIO) configuration
const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

const BUCKET_NAME = process.env.S3_BUCKET || 'dms-documents';

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize database and services
async function initializeServices() {
  try {
    // Create database table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        s3_key VARCHAR(255),
        ocr_text TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Elasticsearch index
    const indexExists = await esClient.indices.exists({ index: 'documents' });
    if (!indexExists) {
      await esClient.indices.create({
        index: 'documents',
        mappings: {
          properties: {
            filename: { type: 'text' },
            original_name: { type: 'text' },
            ocr_text: { type: 'text' },
            mime_type: { type: 'keyword' },
            file_size: { type: 'integer' },
            created_at: { type: 'date' }
          }
        }
      });
    }

    // Create S3 bucket
    try {
      await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
    } catch (error: any) {
      if (error.code !== 'BucketAlreadyOwnedByYou') {
        console.log('Bucket creation error:', error.message);
      }
    }

    console.log('Services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
  }
}

// OCR function
async function performOCR(filePath: string): Promise<string> {
  try {
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    return '';
  }
}

// Upload document endpoint
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const s3Key = `documents/${Date.now()}-${file.originalname}`;

    // Upload to S3
    const fileContent = fs.readFileSync(file.path);
    await s3.upload({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: file.mimetype
    }).promise();

    // Perform OCR if it's an image
    let ocrText = '';
    if (file.mimetype.startsWith('image/')) {
      ocrText = await performOCR(file.path);
    }
    else if (file.mimetype === 'application/pdf') {
      const pdfBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse.default(pdfBuffer);
      ocrText = pdfData.text;
    }
    else if (file.mimetype.startsWith('text/')) {
      file.originalname.match(/md|txt/i)
      ocrText = fs.readFileSync(file.path, 'utf-8');
    }
    else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const docBuffer = fs.readFileSync(file.path);
      const docData = await mammoth.extractRawText({ buffer: docBuffer });
      ocrText = docData.value;
    }

    const result = await pool.query(
      `INSERT INTO documents (filename, original_name, file_path, s3_key, ocr_text, file_size, mime_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [file.filename, file.originalname, file.path, s3Key, ocrText, file.size, file.mimetype]
    );

    const document = result.rows[0];

    // Index in Elasticsearch
    await esClient.index({
      index: 'documents',
      id: document.id.toString(),
      document: {
        filename: document.filename,
        original_name: document.original_name,
        ocr_text: document.ocr_text,
        mime_type: document.mime_type,
        file_size: document.file_size,
        created_at: document.created_at
      }
    });

    // Clean up temporary file
    fs.unlinkSync(file.path);

    res.json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        original_name: document.original_name,
        s3_key: document.s3_key,
        ocr_text: document.ocr_text,
        file_size: document.file_size,
        mime_type: document.mime_type,
        created_at: document.created_at
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Search documents endpoint
app.get('/api/documents/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResult = await esClient.search({
      index: 'documents',
      query: {
        multi_match: {
          query: q as string,
          fields: ['filename', 'original_name', 'ocr_text']
        }
      }
    });

    const documents = searchResult.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      ...hit._source
    }));

    res.json({ documents });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all documents endpoint
app.get('/api/documents', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, filename, original_name, s3_key, file_size, mime_type, created_at FROM documents ORDER BY created_at DESC'
    );
    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// Download document endpoint
app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM documents WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];
    
    // Get file from S3
    const s3Object = await s3.getObject({
      Bucket: BUCKET_NAME,
      Key: document.s3_key
    }).promise();

    // Pastikan Body ada dan dalam format Buffer
    if (!s3Object.Body) {
      return res.status(404).json({ error: 'File content not found' });
    }

    // Convert Body ke Buffer jika perlu
    const fileBuffer = Buffer.isBuffer(s3Object.Body) 
      ? s3Object.Body 
      : Buffer.from(s3Object.Body as any);

    // Set headers yang tepat
    res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${document.original_name}"`);
    
    // Kirim file sebagai buffer
    res.end(fileBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check Elasticsearch
    await esClient.ping();
    
    // Check S3
    await s3.listBuckets().promise();
    
    res.json({ 
      status: 'healthy',
      services: {
        database: 'connected',
        elasticsearch: 'connected',
        s3: 'connected'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: 'One or more services are unavailable'
    });
  }
});

// Simple HTML interface
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>DMS PoC</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        input, button { margin: 5px; padding: 10px; }
        button { background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .result { margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>Data Management System PoC</h1>
    
    <div class="section">
        <h2>Upload Document</h2>
        <form id="uploadForm" enctype="multipart/form-data">
            <input type="file" id="fileInput" name="document" accept="*/*" required>
            <button type="submit">Upload</button>
        </form>
        <div id="uploadResult" class="result" style="display:none;"></div>
    </div>
    
    <div class="section">
        <h2>Search Documents</h2>
        <input type="text" id="searchInput" placeholder="Enter search query...">
        <button onclick="searchDocuments()">Search</button>
        <div id="searchResult" class="result" style="display:none;"></div>
    </div>
    
    <div class="section">
        <h2>All Documents</h2>
        <button onclick="loadDocuments()">Load Documents</button>
        <div id="documentsResult" class="result" style="display:none;"></div>
    </div>
    
    <script>
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            const fileInput = document.getElementById('fileInput');
            formData.append('document', fileInput.files[0]);
            
            try {
                const response = await fetch('/api/documents/upload', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                document.getElementById('uploadResult').style.display = 'block';
                document.getElementById('uploadResult').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('uploadResult').style.display = 'block';
                document.getElementById('uploadResult').innerHTML = 'Error: ' + error.message;
            }
        });
        
        async function searchDocuments() {
            const query = document.getElementById('searchInput').value;
            if (!query) return;
            
            try {
                const response = await fetch('/api/documents/search?q=' + encodeURIComponent(query));
                const result = await response.json();
                document.getElementById('searchResult').style.display = 'block';
                document.getElementById('searchResult').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('searchResult').style.display = 'block';
                document.getElementById('searchResult').innerHTML = 'Error: ' + error.message;
            }
        }
        
        async function loadDocuments() {
            try {
                const response = await fetch('/api/documents');
                const result = await response.json();
                document.getElementById('documentsResult').style.display = 'block';
                document.getElementById('documentsResult').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('documentsResult').style.display = 'block';
                document.getElementById('documentsResult').innerHTML = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>`);
});

// Start server
async function startServer() {
  await initializeServices();
  app.listen(PORT, () => {
    console.log(`DMS PoC server running on port ${PORT}`);
    console.log(`Web interface: http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  POST /api/documents/upload - Upload document`);
    console.log(`  GET /api/documents/search?q=query - Search documents`);
    console.log(`  GET /api/documents - Get all documents`);
    console.log(`  GET /api/documents/:id/download - Download document`);
    console.log(`  GET /api/health - Health check`);
  });
}

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});