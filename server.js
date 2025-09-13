// server.js
const express = require('express');
const multer  = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files from "public"
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads dir exists
const UPLOADS_ROOT = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT);

// Multer storage: store in uploads/:sessionId/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const sessionId = req.params.sessionId;
    const sessionDir = path.join(UPLOADS_ROOT, sessionId);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    cb(null, sessionDir);
  },
  filename: function (req, file, cb) {
    const ts = Date.now();
    const unique = uuidv4();
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${ts}_${unique}${ext}`);
  }
});
const upload = multer({ storage: storage });

// Endpoint to receive uploaded blobs (from client)
app.post('/upload/:sessionId', upload.single('clip'), (req, res) => {
  const sessionId = req.params.sessionId;
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file received' });
  }
  console.log(`Saved file for session ${sessionId}: ${req.file.filename}`);
  res.json({ ok: true, filename: req.file.filename });
});

// Endpoint to list files for a session (owner UI will call)
app.get('/owner/files/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const sessionDir = path.join(UPLOADS_ROOT, sessionId);
  if (!fs.existsSync(sessionDir)) return res.json({ ok: true, files: [] });
  const files = fs.readdirSync(sessionDir)
    .map(f => ({ name: f, path: `/uploads/${sessionId}/${f}`, mtime: fs.statSync(path.join(sessionDir, f)).mtime }));
  res.json({ ok: true, files });
});

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_ROOT));

// Simple helper endpoint to create a new session id (returns link)
app.get('/create-session', (req, res) => {
  const id = uuidv4();
  const host = req.get('host');
  const origin = `${req.protocol}://${host}`;
  res.json({
    ok: true,
    sessionId: id,
    participantLink: `${origin}/?id=${id}`,
    ownerLink: `${origin}/owner.html?id=${id}`
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Open http://localhost:3000/create-session to create a session ID');
});
