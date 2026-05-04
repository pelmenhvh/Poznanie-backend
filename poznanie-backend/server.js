require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();

// ===== ПОДКЛЮЧЕНИЕ К БД =====
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Проверка подключения к БД
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
    } else {
        console.log('✅ База данных подключена успешно');
        release();
    }
});


// ТЕСТОВЫЙ МАРШРУТ ДЛЯ ДИАГНОСТИКИ
app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Backend is running!',
        time: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

// ===== CORS =====
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://poznanie-frontend-g3ty.onrender.com']
    : ['http://localhost:3000'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// ===== ЗАГРУЗКА ФАЙЛОВ =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Только изображения!'));
    }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    res.json({ imageUrl: `${baseUrl}/uploads/${req.file.filename}` });
});

// ===== ИМПОРТ РОУТОВ =====
const authRoutes = require('./routes/auth');
const articleRoutes = require('./routes/articles');
const userRoutes = require('./routes/users');
const likeRoutes = require('./routes/likes');

// ===== РОУТЫ =====
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/likes', likeRoutes);

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'OK', database: 'connected', time: result.rows[0].now });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', database: 'disconnected', error: error.message });
    }
});

// ===== СТАТИКА ДЛЯ ФРОНТА (опционально) =====
if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../frontend/dist');
    if (fs.existsSync(frontendPath)) {
        app.use(express.static(frontendPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(frontendPath, 'index.html'));
        });
    }
}

// ===== ЗАПУСК =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌍 Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 CORS разрешён для: ${allowedOrigins.join(', ')}`);
    console.log(`💾 База данных: ${process.env.DATABASE_URL ? 'настроена ✅' : 'не настроена ❌'}\n`);
});
