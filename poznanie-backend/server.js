require('dotenv').config();
const express = require('express');
const pool = require('./db/index');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const articleRoutes = require('./routes/articles');
const userRoutes = require('./routes/users');
const likeRoutes = require('./routes/likes');

const app = express();

app.get('/ping', (req, res) => {
  res.send('pong');
});

// Настройка CORS
app.use(cors({
    origin: [
        'https://poznanie-frontend-g3ty.onrender.com',
        'http://localhost:5173'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());

// Настройка хранения файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName)
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Только изображения!'));
  }
});

// Создаём папку uploads, если её нет
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Эндпоинт для загрузки изображений
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/likes', likeRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
