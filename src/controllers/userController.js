const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { sendOtpEmail } = require('../utils/mailer');

const SALT_ROUNDS = 10;

// Render pages
exports.showRegisterPage = (req, res) => res.render('register');
exports.showLoginPage = (req, res) => res.render('login');
exports.showVerifyPage = (req, res) => {
    // Pass the email from the query parameter to the view
    const email = req.query.email;
    res.render('verify', { email });
};

// Handle User Registration
exports.registerUser = async (req, res) => {
    const { firstName, lastName, email, password, dateOfBirth, phone1, phone2 } = req.body;
    const connection = await pool.getConnection();

    try {
        // Check if user already exists
        const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).send('User with this email already exists.');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Start transaction
        await connection.beginTransaction();

        // Insert into users table
        const [result] = await connection.query(
            'INSERT INTO users (first_name, last_name, email, password, date_of_birth) VALUES (?, ?, ?, ?, ?)',
            [firstName, lastName, email, hashedPassword, dateOfBirth]
        );
        const userId = result.insertId;

        // Insert phone numbers
        await connection.query('INSERT INTO user_phones (user_id, phone_number) VALUES (?, ?)', [userId, phone1]);
        if (phone2) {
            await connection.query('INSERT INTO user_phones (user_id, phone_number) VALUES (?, ?)', [userId, phone2]);
        }
        
        // Generate and store OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
        
        await connection.query('INSERT INTO otps (user_id, otp_code, expires_at) VALUES (?, ?, ?)', [userId, otp, expiresAt]);
        
        // Commit transaction
        await connection.commit();

        // Send OTP email
        await sendOtpEmail(email, otp);

        // Redirect to verification page
        res.redirect(`/user/verify?email=${email}`);

    } catch (error) {
        await connection.rollback();
        console.error('Registration error:', error);
        res.status(500).send('Server error during registration.');
    } finally {
        connection.release();
    }
};

// Handle OTP Verification
// ... (keep the other functions)

// Handle OTP Verification
exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    const connection = await pool.getConnection();

    try {
        const [users] = await connection.query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).send('User not found.');
        }
        const userId = users[0].user_id;

        const [otps] = await connection.query(
            'SELECT * FROM otps WHERE user_id = ? AND otp_code = ? AND expires_at > NOW()',
            [userId, otp]
        );

        if (otps.length === 0) {
            return res.status(400).send('Invalid or expired OTP.');
        }

        // --- NEW LOGIC STARTS HERE ---
        await connection.beginTransaction();

        // 1. Mark user as verified
        await connection.query('UPDATE users SET is_verified = TRUE WHERE user_id = ?', [userId]);

        // 2. Generate a unique 10-digit account number
        let accountNumber;
        let isUnique = false;
        while (!isUnique) {
            accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            const [existingAccount] = await connection.query('SELECT account_id FROM accounts WHERE account_number = ?', [accountNumber]);
            if (existingAccount.length === 0) {
                isUnique = true;
            }
        }
        
        // 3. Create the Primary Account
        const [accountResult] = await connection.query(
            "INSERT INTO accounts (account_number, account_type, balance) VALUES (?, 'PRIMARY', 0.00)",
            [accountNumber]
        );
        const accountId = accountResult.insertId;

        // 4. Link the user to this primary account (using the joint_members table for simplicity)
        // This establishes the 1:1 relationship for primary accounts
        await connection.query('INSERT INTO joint_members (account_id, user_id) VALUES (?, ?)', [accountId, userId]);

        // 5. Delete the used OTP
        await connection.query('DELETE FROM otps WHERE user_id = ?', [userId]);
        
        await connection.commit();
        // --- NEW LOGIC ENDS HERE ---

        res.redirect('/user/login');

    } catch (error) {
        await connection.rollback();
        console.error('OTP verification error:', error);
        res.status(500).send('Server error during OTP verification.');
    } finally {
        connection.release();
    }
};

// ... (keep the loginUser function)
// Handle User Login
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).send('Invalid credentials.');
        }
        const user = users[0];

        // Check if account is verified
        if (!user.is_verified) {
            return res.status(401).send('Account not verified. Please check your email for an OTP.');
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid credentials.');
        }

        // Generate JWT
        const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET || 'your_default_secret', { expiresIn: '1h' });
        
        // Add JWT_SECRET to .env file
        // e.g., JWT_SECRET=a_very_long_random_string_of_characters

        // Set token in a cookie
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        
        // For now, we just send a success message. We'll redirect to the dashboard in the next step.
       res.redirect('/account/dashboard');

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error during login.');
    }
};

exports.showJointLoginPage = (req, res) => res.render('joint-login');


// Handle Joint Account Login
exports.handleJointLogin = async (req, res) => {
    const { accountNumber, password } = req.body;

    try {
        const [accounts] = await pool.query(
            "SELECT * FROM accounts WHERE account_number = ? AND account_type = 'JOINT'",
            [accountNumber]
        );

        if (accounts.length === 0) {
            return res.status(400).send("Invalid joint account number or password.");
        }
        const account = accounts[0];

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(400).send("Invalid joint account number or password.");
        }

        // Create a special JWT for the joint account session
        const token = jwt.sign(
            { accountId: account.account_id, isJoint: true },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, { httpOnly: true });
        res.redirect('/account/joint/dashboard');

    } catch (error) {
        console.error('Joint login error:', error);
        res.status(500).send('Server error during joint login.');
    }
};