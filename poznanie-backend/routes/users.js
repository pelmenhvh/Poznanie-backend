const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Получить профиль пользователя
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            `SELECT id, email, name, avatar, banner, bio, location, website, interests, created_at
             FROM users WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const articlesResult = await pool.query(
            'SELECT * FROM articles WHERE author_id = $1 ORDER BY created_at DESC',
            [id]
        );
        
        const user = result.rows[0];
        user.articles = articlesResult.rows;
        
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить всех пользователей (для аватарок)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, avatar FROM users ORDER BY id'
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить профиль
router.put('/profile', authMiddleware, async (req, res) => {
    const { name, bio, location, website, interests, avatar, banner } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE users 
             SET name = COALESCE($1, name),
                 bio = COALESCE($2, bio),
                 location = COALESCE($3, location),
                 website = COALESCE($4, website),
                 interests = COALESCE($5, interests),
                 avatar = COALESCE($6, avatar),
                 banner = COALESCE($7, banner),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8
             RETURNING id, email, name, avatar, banner, bio, location, website, interests`,
            [name, bio, location, website, interests, avatar, banner, req.userId]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить рейтинг пользователя (сумма лайков на всех статьях)
router.get('/:id/rating', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT COALESCE(SUM(likes), 0) as total_likes FROM articles WHERE author_id = $1',
            [id]
        );
        
        res.json({
            userId: parseInt(id),
            totalLikes: parseInt(result.rows[0].total_likes)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить топ пользователей по лайкам
router.get('/top/rating', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.avatar, COALESCE(SUM(a.likes), 0) as total_likes
             FROM users u
             LEFT JOIN articles a ON u.id = a.author_id
             GROUP BY u.id, u.name, u.avatar
             ORDER BY total_likes DESC
             LIMIT 10`
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;