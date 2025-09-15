const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');


// Render the main dashboard
// Render the main dashboard
exports.getDashboard = async (req, res) => {
    const userId = req.user.userId;

    try {
        // --- NEW ---
        // Fetch the user's admin status
        const [userRows] = await pool.query('SELECT is_admin FROM users WHERE user_id = ?', [userId]);
        const user = userRows[0];
        // --- END NEW ---
        
        // Find the user's primary account
        const [accountQueryResult] = await pool.query(
            `SELECT a.* FROM accounts a
             JOIN joint_members jm ON a.account_id = jm.account_id
             WHERE jm.user_id = ? AND a.account_type = 'PRIMARY'`,
            [userId]
        );

        if (accountQueryResult.length === 0) {
            return res.status(404).send("Primary account not found.");
        }
        const account = accountQueryResult[0];

        // Get recent transactions for the account
        const [transactions] = await pool.query(
            `SELECT * FROM transactions 
             WHERE from_account_id = ? OR to_account_id = ? 
             ORDER BY timestamp DESC LIMIT 10`,
            [account.account_id, account.account_id]
        );

        // Get loan data
        const [loans] = await pool.query('SELECT * FROM loans WHERE account_id = ? ORDER BY request_date DESC', [account.account_id]);

        // Pass the user object to the render function
        res.render('dashboard', { user, account, transactions, loans });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Server Error');
    }
};

// Handle Deposit
exports.handleDeposit = async (req, res) => {
    const { amount, accountId } = req.body;
    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).send("Invalid deposit amount.");
    }
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Add funds to the account
        await connection.query('UPDATE accounts SET balance = balance + ? WHERE account_id = ?', [depositAmount, accountId]);

        // Create a transaction record
        await connection.query(
            'INSERT INTO transactions (to_account_id, amount, transaction_type) VALUES (?, ?, ?)',
            [accountId, depositAmount, 'DEPOSIT']
        );
        
        await connection.commit();
        req.flash('success_msg', 'Deposit successful!')
        res.redirect('/account/dashboard');
    } catch (error) {
        await connection.rollback();
        console.error('Deposit error:', error);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};

// Handle Withdrawal
exports.handleWithdrawal = async (req, res) => {
    const { amount, accountId } = req.body;
    const withdrawalAmount = parseFloat(amount);
    
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).send("Invalid withdrawal amount.");
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Check for sufficient funds
        const [rows] = await connection.query('SELECT balance FROM accounts WHERE account_id = ? FOR UPDATE', [accountId]);
        const currentBalance = rows[0].balance;

        if (currentBalance < withdrawalAmount) {
            await connection.rollback();
            return res.status(400).send("Insufficient funds.");
        }

        // Subtract funds
        await connection.query('UPDATE accounts SET balance = balance - ? WHERE account_id = ?', [withdrawalAmount, accountId]);

        // Create transaction record
        await connection.query(
            'INSERT INTO transactions (from_account_id, amount, transaction_type) VALUES (?, ?, ?)',
            [accountId, withdrawalAmount, 'WITHDRAWAL']
        );
        
        await connection.commit();
        req.flash('success_msg', 'Withdrawal successful!');
        res.redirect('/account/dashboard');
    } catch (error) {
        await connection.rollback();
        console.error('Withdrawal error:', error);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};


// Handle Transfer
exports.handleTransfer = async (req, res) => {
    const { amount, toAccountNumber, fromAccountId } = req.body;
    const transferAmount = parseFloat(amount);

    if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).send("Invalid transfer amount.");
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Get sender account and lock the row
        const [senderRows] = await connection.query('SELECT balance FROM accounts WHERE account_id = ? FOR UPDATE', [fromAccountId]);
        if (senderRows[0].balance < transferAmount) {
            await connection.rollback();
            return res.status(400).send("Insufficient funds.");
        }

        // Get recipient account and lock the row
        const [recipientRows] = await connection.query('SELECT account_id FROM accounts WHERE account_number = ? FOR UPDATE', [toAccountNumber]);
        if (recipientRows.length === 0) {
            await connection.rollback();
            return res.status(404).send("Recipient account not found.");
        }
        const toAccountId = recipientRows[0].account_id;

        if (parseInt(fromAccountId) === toAccountId) {
            await connection.rollback();
            return res.status(400).send("Cannot transfer to the same account.");
        }

        // Perform the transfer
        await connection.query('UPDATE accounts SET balance = balance - ? WHERE account_id = ?', [transferAmount, fromAccountId]);
        await connection.query('UPDATE accounts SET balance = balance + ? WHERE account_id = ?', [transferAmount, toAccountId]);
        
        // Create transaction record
        await connection.query(
            'INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type) VALUES (?, ?, ?, ?)',
            [fromAccountId, toAccountId, transferAmount, 'TRANSFER']
        );

        await connection.commit();
        req.flash('success_msg', 'Transfer successful!');
        res.redirect('/account/dashboard');
    } catch (error) {
        await connection.rollback();
        req.flash('error_msg', 'Transfer failed.');
        console.error('Transfer error:', error);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};

exports.showCreateJointAccountPage = (req, res) => {
    res.render('create-joint');
};



// Handle the creation of a joint account
exports.handleCreateJointAccount = async (req, res) => {
    const creatorId = req.user.userId;
    const { email1, email2, email3, email4 } = req.body;
    const memberEmails = [email1, email2, email3, email4].filter(email => email); // Filter out empty strings

    if (memberEmails.length < 1) {
        return res.status(400).send("You must invite at least one other member.");
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Find user IDs for all invited emails + creator
        const allEmails = [...memberEmails, (await connection.query('SELECT email FROM users WHERE user_id = ?', [creatorId]))[0][0].email];
        const [members] = await connection.query('SELECT user_id, email FROM users WHERE email IN (?)', [allEmails]);

        if (members.length !== allEmails.length) {
            await connection.rollback();
            return res.status(400).send("One or more invited emails do not correspond to a registered user.");
        }

        // Generate account number
        const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        
        // Generate a random password (simple version)
        const plainPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Create the joint account
        const [accountResult] = await connection.query(
            "INSERT INTO accounts (account_number, account_type, password, balance) VALUES (?, 'JOINT', ?, 0.00)",
            [accountNumber, hashedPassword]
        );
        const accountId = accountResult.insertId;

        // Add all members to the joint_members table
        const memberValues = members.map(member => [accountId, member.user_id]);
        await connection.query('INSERT INTO joint_members (account_id, user_id) VALUES ?', [memberValues]);

        await connection.commit();

        // TODO: Send email to all members with account number and plainPassword
        console.log(`Joint Account Created! Number: ${accountNumber}, Password: ${plainPassword}`);

        res.redirect('/account/dashboard');
    } catch (error) {
        await connection.rollback();
        console.error('Joint account creation error:', error);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};

// Render the joint dashboard
exports.getJointDashboard = async (req, res) => {
    const accountId = req.account.accountId;
    try {
        const [accountResult] = await pool.query('SELECT * FROM accounts WHERE account_id = ?', [accountId]);
        const [membersResult] = await pool.query(
            `SELECT u.first_name, u.last_name, u.email FROM users u
             JOIN joint_members jm ON u.user_id = jm.user_id
             WHERE jm.account_id = ?`,
            [accountId]
        );
        // We can reuse the transaction fetching logic here
        const [transactions] = await pool.query(
            `SELECT * FROM transactions WHERE from_account_id = ? OR to_account_id = ? ORDER BY timestamp DESC LIMIT 10`,
            [accountId, accountId]
        );
        // ... inside getJointDashboard ...
// After getting membersResult:
const [loans] = await pool.query('SELECT * FROM loans WHERE account_id = ? ORDER BY request_date DESC', [accountId]);

res.render('joint-dashboard', { // Add loans here
    account: accountResult[0],
    members: membersResult,
    transactions,
    loans 
});

      
    } catch (error) {
        console.error('Joint dashboard error:', error);
        res.status(500).send('Server Error in joint dashboard.');
    }
};


// --- Joint Account Transaction Handlers ---

// Handle Joint Deposit
exports.handleJointDeposit = async (req, res) => {
    const { amount, accountId } = req.body;
    // The core logic is the same as the primary handleDeposit
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) return res.status(400).send("Invalid deposit amount.");
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('UPDATE accounts SET balance = balance + ? WHERE account_id = ?', [depositAmount, accountId]);
        await connection.query('INSERT INTO transactions (to_account_id, amount, transaction_type) VALUES (?, ?, ?)', [accountId, depositAmount, 'DEPOSIT']);
        await connection.commit();

        req.flash('success_msg', 'Deposit successful!');
        // ** THE FIX IS HERE: Redirect to the JOINT dashboard **
        res.redirect('/account/joint/dashboard');

    } catch (error) {
        await connection.rollback();
        req.flash('error_msg', 'Deposit failed.');
        console.error('Joint Deposit error:', error);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};

// Handle Joint Withdrawal
exports.handleJointWithdrawal = async (req, res) => {
    const { amount, accountId } = req.body;
    // The core logic is the same as the primary handleWithdrawal
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) return res.status(400).send("Invalid withdrawal amount.");

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT balance FROM accounts WHERE account_id = ? FOR UPDATE', [accountId]);
        if (rows[0].balance < withdrawalAmount) {
            await connection.rollback();
            return res.status(400).send("Insufficient funds.");
        }
        await connection.query('UPDATE accounts SET balance = balance - ? WHERE account_id = ?', [withdrawalAmount, accountId]);
        await connection.query('INSERT INTO transactions (from_account_id, amount, transaction_type) VALUES (?, ?, ?)',[accountId, withdrawalAmount, 'WITHDRAWAL']);
        await connection.commit();
        req.flash('success_msg', 'Withdrawal successful!');

        // ** THE FIX IS HERE: Redirect to the JOINT dashboard **
        res.redirect('/account/joint/dashboard');

    } catch (error) {
        await connection.rollback();
        req.flash('error_msg', 'Withdrawal failed.');
        console.error('Joint Withdrawal error:', error);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};

// Handle Joint Transfer
exports.handleJointTransfer = async (req, res) => {
    // This is an alias to the main transfer function, which is fine, but we will add the redirect fix.
    const { amount, toAccountNumber, fromAccountId } = req.body;
    const transferAmount = parseFloat(amount);

    if (isNaN(transferAmount) || transferAmount <= 0) return res.status(400).send("Invalid transfer amount.");

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [senderRows] = await connection.query('SELECT balance FROM accounts WHERE account_id = ? FOR UPDATE', [fromAccountId]);
        if (senderRows[0].balance < transferAmount) {
            await connection.rollback();
            return res.status(400).send("Insufficient funds.");
        }
        const [recipientRows] = await connection.query('SELECT account_id FROM accounts WHERE account_number = ? FOR UPDATE', [toAccountNumber]);
        if (recipientRows.length === 0) {
            await connection.rollback();
            return res.status(404).send("Recipient account not found.");
        }
        const toAccountId = recipientRows[0].account_id;
        if (parseInt(fromAccountId) === toAccountId) {
            await connection.rollback();
            return res.status(400).send("Cannot transfer to the same account.");
        }
        await connection.query('UPDATE accounts SET balance = balance - ? WHERE account_id = ?', [transferAmount, fromAccountId]);
        await connection.query('UPDATE accounts SET balance = balance + ? WHERE account_id = ?', [transferAmount, toAccountId]);
        await connection.query('INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type) VALUES (?, ?, ?, ?)', [fromAccountId, toAccountId, transferAmount, 'TRANSFER']);
        await connection.commit();
        req.flash('success_msg', 'Transfer successful!');

        // ** THE FIX IS HERE: Redirect to the JOINT dashboard **
        res.redirect('/account/joint/dashboard');
        
    } catch (error) {
        await connection.rollback();
        req.flash('error_msg', 'Transfer failed.');
        console.error('Joint Transfer error:', error);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};

// --- Loan Application Handlers ---

// Show loan application page for primary account
exports.showLoanApplicationPage = async (req, res) => {
    const userId = req.user.userId;
    try {
        const [accountQueryResult] = await pool.query(
            `SELECT a.account_id, a.account_number FROM accounts a JOIN joint_members jm ON a.account_id = jm.account_id WHERE jm.user_id = ? AND a.account_type = 'PRIMARY'`,
            [userId]
        );
        const account = accountQueryResult[0];
        res.render('apply-loan', { accountId: account.account_id, accountNumber: account.account_number });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// Handle loan application for primary account
// Handle loan application for primary account
exports.handleLoanApplication = async (req, res) => {
    const userId = req.user.userId;
    const { accountId, loanType, amount } = req.body;

    try {
        // Business Rule: Check if user is a minor
        const [userRows] = await pool.query('SELECT date_of_birth FROM users WHERE user_id = ?', [userId]);
        const dob = new Date(userRows[0].date_of_birth);
        const age = new Date().getFullYear() - dob.getFullYear();
        if (age < 18) {
            req.flash('error_msg', 'Users under 18 cannot apply for loans.');
            return res.redirect('/account/dashboard');
        }

        // --- THE FIX IS HERE ---
        // Business Rule: Check for existing PENDING loans of the same type.
        // We removed 'APPROVED' from the check.
        const [existingLoans] = await pool.query(
            "SELECT loan_id FROM loans WHERE account_id = ? AND loan_type = ? AND status = 'PENDING'",
            [accountId, loanType]
        );

        if (existingLoans.length > 0) {
            req.flash('error_msg', `A pending loan of type '${loanType}' already exists for this account.`);
            return res.redirect('/account/dashboard');
        }
        // --- END OF FIX ---

        // Insert new loan application
        await pool.query(
            'INSERT INTO loans (account_id, loan_type, amount, status) VALUES (?, ?, ?, ?)',
            [accountId, loanType, amount, 'PENDING']
        );
        
        req.flash('success_msg', 'Your loan application has been submitted successfully!');
        res.redirect('/account/dashboard');
    } catch (error) {
        console.error("Loan application error:", error);
        res.status(500).send("Server Error");
    }
};
// Show loan application page for joint account
exports.showJointLoanApplicationPage = async (req, res) => {
    const accountId = req.account.accountId;
    try {
        const [accountResult] = await pool.query('SELECT * FROM accounts WHERE account_id = ?', [accountId]);
        res.render('apply-joint-loan', { account: accountResult[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// Handle loan application for joint account
exports.handleJointLoanApplication = async (req, res) => {
    const { accountId, loanType, amount } = req.body;
    try {
        // Business Rule: Joint accounts can only have one business loan ever
        const [existingLoans] = await pool.query('SELECT loan_id FROM loans WHERE account_id = ?', [accountId]);
        if (existingLoans.length > 0) {
            return res.status(400).send("This joint account already has a loan application and is not eligible for another.");
        }
        if (loanType !== 'Business') {
            return res.status(400).send("Joint accounts can only apply for Business loans.");
        }

        await pool.query('INSERT INTO loans (account_id, loan_type, amount, status) VALUES (?, ?, ?, ?)', [accountId, loanType, amount, 'PENDING']);

        req.flash('success_msg', 'Loan application submitted successfully!');
        res.redirect('/account/joint/dashboard');
    } catch (error) {
        console.error("Joint loan application error:", error);
        req.flash('error_msg', 'Failed to submit loan application.');
        res.redirect('/account/joint/dashboard');
    }
};