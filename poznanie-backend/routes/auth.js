const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/index');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    
    try {
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const avatar = `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${encodeURIComponent(name)}`;
        
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, avatar) 
             VALUES ($1, $2, $3, $4) RETURNING id, email, name, avatar, bio, location`,
            [email, passwordHash, name, avatar]
        );
        
        const user = result.rows[0];
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ token, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await pool.query(
            'SELECT id, email, password_hash, name, avatar, bio, location, website FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        delete user.password_hash;
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ token, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/me', async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Нет токена' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(
            'SELECT id, email, name, avatar, banner, bio, location, website, interests FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(401).json({ error: 'Неверный токен' });
    }
});

module.exports = router;
