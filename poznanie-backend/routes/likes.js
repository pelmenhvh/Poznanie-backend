const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/:articleId', authMiddleware, async (req, res) => {
    const { articleId } = req.params;
    const userId = req.userId;
    
    try {
        const existingLike = await pool.query(
            'SELECT id FROM article_likes WHERE user_id = $1 AND article_id = $2',
            [userId, articleId]
        );
        
        if (existingLike.rows.length > 0) {
            await pool.query('DELETE FROM article_likes WHERE user_id = $1 AND article_id = $2', [userId, articleId]);
            await pool.query('UPDATE articles SET likes = likes - 1 WHERE id = $1', [articleId]);
            res.json({ liked: false, message: 'Лайк удалён' });
        } else {
            await pool.query('INSERT INTO article_likes (user_id, article_id) VALUES ($1, $2)', [userId, articleId]);
            await pool.query('UPDATE articles SET likes = likes + 1 WHERE id = $1', [articleId]);
            res.json({ liked: true, message: 'Лайк добавлен' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/:articleId/status', authMiddleware, async (req, res) => {
    const { articleId } = req.params;
    const userId = req.userId;
    
    try {
        const result = await pool.query(
            'SELECT id FROM article_likes WHERE user_id = $1 AND article_id = $2',
            [userId, articleId]
        );
        res.json({ liked: result.rows.length > 0 });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить все лайки текущего пользователя
router.get('/user/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.* FROM articles a
       JOIN article_likes l ON a.id = l.article_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [req.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;