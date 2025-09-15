const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const protectAdmin = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).redirect('/user/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId: 1 }

        // Additional check: Is this user actually an admin in the DB?
        const [userRows] = await pool.query('SELECT is_admin FROM users WHERE user_id = ?', [req.user.userId]);
        
        if (userRows.length === 0 || !userRows[0].is_admin) {
            return res.status(403).send('Forbidden: Access denied.');
        }
        
        next(); // User is an admin, proceed.
    } catch (error) {
        return res.status(401).redirect('/user/login');
    }
};

module.exports = { protectAdmin };