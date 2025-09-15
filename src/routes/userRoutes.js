const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware'); 

// Show registration page
router.get('/register', userController.showRegisterPage);
router.get('/joint/login', userController.showJointLoginPage);

// Handle registration form submission
router.post('/register', userController.registerUser);
router.post('/joint/login', userController.handleJointLogin);

// Show OTP verification page
router.get('/verify', userController.showVerifyPage);

// Handle OTP verification
router.post('/verify', userController.verifyOtp);

// Show login page
router.get('/login', userController.showLoginPage);

// Handle login form submission
router.post('/login', userController.loginUser);

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/user/login');
});

module.exports = router;