require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser'); // Import cookie-parser
const { testConnection } = require('./src/config/db');

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const adminRoutes = require('./src/routes/adminRoutes'); // Add this line


// ... other imports
const session = require('express-session');
const flash = require('connect-flash');

// ... in index.js after app creation
const app = express();

// --- ADD THIS SECTION ---
// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_default_secret_for_session',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 } // Session timeout
}));

// Flash Middleware
app.use(flash());

// Global variables for views
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});
// --- END OF SECTION ---


// ... rest of the file (app.use(express.json()), etc.)


const PORT = process.env.PORT || 3000;

testConnection();

// Middleware
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies
app.use(cookieParser()); // To parse cookies

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static("public"));


// Root route
app.get('/', (req, res) => {
    res.render('index', { title: 'Welcome to Our Bank' });
});

// Use Routes
app.use('/user', userRoutes); 
app.use('/account', accountRoutes); // All account-related routes will be prefixed with /account
app.use('/admin', adminRoutes);
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});