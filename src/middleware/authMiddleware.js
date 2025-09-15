const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).redirect('/user/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_default_secret');
        req.user = decoded; // Adds the user payload (e.g., { userId: 1 }) to the request object
        next(); // User is authenticated, proceed to the next function
    } catch (error) {
        return res.status(401).redirect('/user/login');
    }
};

module.exports = { protect };