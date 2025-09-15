const jwt = require('jsonwebtoken');

const protectJoint = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).redirect('/user/joint/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Check if this token is specifically for a joint account
        if (!decoded.accountId || !decoded.isJoint) {
            throw new Error('Not a joint account token');
        }
        req.account = decoded; // Adds { accountId: 123, isJoint: true } to the request
        next();
    } catch (error) {
        console.error("Joint Auth Error:", error.message);
        return res.status(401).redirect('/user/joint/login');
    }
};

module.exports = { protectJoint };