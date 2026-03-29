import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Preserve original extension, add timestamp for uniqueness
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    // Allow common file types
    const allowed = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|png|jpg|jpeg|gif|bmp|webp|mp4|mp3)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// Upload multiple files
router.post('/files', authMiddleware, upload.array('files', 10), (req: AuthRequest, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ code: 400, message: '没有上传文件' });
  }

  const result = files.map(f => ({
    name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
    size: f.size > 1024 * 1024
      ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
      : `${(f.size / 1024).toFixed(0)} KB`,
    url: `/api/uploads/${f.filename}`,
    filename: f.filename
  }));

  return res.json({ code: 0, data: result });
});

// Serve uploaded files (download / preview)
router.get('/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ code: 404, message: '文件不存在' });
  }

  // For images, serve inline for preview; others as download
  const ext = path.extname(req.params.filename).toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  if (imageExtensions.includes(ext)) {
    res.setHeader('Content-Disposition', 'inline');
  } else {
    // Extract original filename from stored name (after timestamp-random-)
    const parts = req.params.filename.split('-');
    const originalName = parts.slice(2).join('-');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
  }

  res.sendFile(filePath);
});

export default router;
