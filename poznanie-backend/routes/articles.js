const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 🔧 helper для нормализации автора
const formatArticle = (row) => ({
    ...row,
    author: {
        id: row.author_id,
        name: row.author_name,
        avatar: row.author_avatar
    }
});

// Получить все статьи
router.get('/', async (req, res) => {
    const { category } = req.query;
    
    try {
        let query = `SELECT * FROM articles`;
        let params = [];
        
        if (category && category !== 'all') {
            query += ` WHERE category = $1 ORDER BY created_at DESC`;
            params.push(category);
        } else {
            query += ` ORDER BY created_at DESC`;
        }
        
        const result = await pool.query(query, params);

        const articles = result.rows.map(formatArticle);

        res.json(articles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Топ статьи по лайкам
router.get('/top/likes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM articles ORDER BY likes DESC, created_at DESC LIMIT 3`
        );

        const articles = result.rows.map(formatArticle);

        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Популярные статьи
router.get('/trending', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM articles ORDER BY views DESC LIMIT 10`
        );

        const articles = result.rows.map(formatArticle);

        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить одну статью
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await pool.query(
            'UPDATE articles SET views = views + 1 WHERE id = $1',
            [id]
        );

        const result = await pool.query(
            `SELECT * FROM articles WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Статья не найдена' });
        }

        const article = formatArticle(result.rows[0]);
        
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать статью
router.post('/', authMiddleware, async (req, res) => {
    const { title, category, readTime, shortContent, fullContent, image } = req.body;
    
    try {
        const userResult = await pool.query(
            'SELECT name, avatar FROM users WHERE id = $1',
            [req.userId]
        );

        const author = userResult.rows[0];
        
        const result = await pool.query(
            `INSERT INTO articles 
             (title, category, read_time, short_content, full_content, 
              author_id, author_name, author_avatar, image)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                title,
                category,
                readTime || 5,
                shortContent,
                fullContent,
                req.userId,
                author.name,
                author.avatar,
                image || null
            ]
        );

        const article = formatArticle(result.rows[0]);
        
        res.status(201).json(article);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить статью
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, category, readTime, shortContent, fullContent, image } = req.body;
    
    try {
        const articleCheck = await pool.query(
            'SELECT author_id FROM articles WHERE id = $1',
            [id]
        );
        
        if (articleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Статья не найдена' });
        }
        
        if (articleCheck.rows[0].author_id !== req.userId) {
            return res.status(403).json({ error: 'Нет прав на редактирование' });
        }
        
        const result = await pool.query(
            `UPDATE articles 
             SET title = $1, category = $2, read_time = $3, 
                 short_content = $4, full_content = $5, image = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 RETURNING *`,
            [title, category, readTime, shortContent, fullContent, image, id]
        );

        const article = formatArticle(result.rows[0]);
        
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить статью
router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    try {
        const articleCheck = await pool.query(
            'SELECT author_id FROM articles WHERE id = $1',
            [id]
        );
        
        if (articleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Статья не найдена' });
        }
        
        if (articleCheck.rows[0].author_id !== req.userId) {
            return res.status(403).json({ error: 'Нет прав на удаление' });
        }
        
        await pool.query('DELETE FROM articles WHERE id = $1', [id]);

        res.json({ message: 'Статья удалена' });
    } catch (error) {
        console.error('Ошибка удаления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Поиск
router.get('/search/:query', async (req, res) => {
    const { query } = req.params;
    
    try {
        const result = await pool.query(
            `SELECT * FROM articles 
             WHERE title ILIKE $1 OR author_name ILIKE $1 OR category ILIKE $1
             ORDER BY created_at DESC`,
            [`%${query}%`]
        );

        const articles = result.rows.map(formatArticle);

        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
