const { pool } = require('../config/db');

// Show the main admin dashboard with pending loans
// Show the main admin dashboard with enhanced data
exports.getAdminDashboard = async (req, res) => {
    try {
        // Query 1: Get key statistics
        const [statsRows] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM users) AS totalUsers,
                (SELECT COUNT(*) FROM accounts) AS totalAccounts,
                (SELECT SUM(balance) FROM accounts) AS totalAssets,
                (SELECT COUNT(*) FROM loans WHERE status = 'PENDING') AS pendingLoans
            `
        );
        const stats = statsRows[0];

        // Query 2: Get ALL loans, not just pending ones
        const [allLoans] = await pool.query(
            `SELECT 
                l.*, 
                a.account_number,
                GROUP_CONCAT(CONCAT(u.first_name, ' ', u.last_name) SEPARATOR ', ') AS applicant_names
             FROM loans l
             JOIN accounts a ON l.account_id = a.account_id
             JOIN joint_members jm ON a.account_id = jm.account_id
             JOIN users u ON jm.user_id = u.user_id
             GROUP BY l.loan_id, a.account_number
             ORDER BY l.request_date DESC`
        );

        // Query 3: Get the 5 most recent transactions in the system
        const [recentTransactions] = await pool.query(
            `SELECT t.*, acc_from.account_number as from_acc, acc_to.account_number as to_acc
             FROM transactions t
             LEFT JOIN accounts acc_from ON t.from_account_id = acc_from.account_id
             LEFT JOIN accounts acc_to ON t.to_account_id = acc_to.account_id
             ORDER BY t.timestamp DESC
             LIMIT 5`
        );

        res.render('admin-dashboard', { 
            stats,
            allLoans,
            recentTransactions
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).send('Server Error');
    }
};
// Approve a loan
exports.approveLoan = async (req, res) => {
    const { loanId } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get loan details
        const [loanRows] = await connection.query('SELECT * FROM loans WHERE loan_id = ? AND status = "PENDING"', [loanId]);
        if (loanRows.length === 0) {
            await connection.rollback();
            return res.status(404).send('Loan not found or already processed.');
        }
        const loan = loanRows[0];

        // 2. Update loan status to APPROVED
        await connection.query('UPDATE loans SET status = "APPROVED", decision_date = NOW() WHERE loan_id = ?', [loanId]);

        // 3. Credit the loan amount to the user's account
        await connection.query('UPDATE accounts SET balance = balance + ? WHERE account_id = ?', [loan.amount, loan.account_id]);

        // 4. Create a transaction record for the loan disbursement
        await connection.query(
            'INSERT INTO transactions (to_account_id, amount, transaction_type) VALUES (?, ?, ?)',
            [loan.account_id, loan.amount, 'LOAN']
        );
        const [[user]] = await connection.query(`SELECT u.email FROM users u JOIN joint_members jm ON u.user_id = jm.user_id WHERE jm.account_id = ? LIMIT 1`, [loan.account_id])

        await connection.commit();
        const { sendLoanStatusEmail } = require('../utils/mailer');
await sendLoanStatusEmail(user.email, loan.loan_type, loan.amount, 'approved');
        req.flash('success_msg', 'Loan approved successfully!');
        res.redirect('/admin/dashboard');
    } catch (error) {
        await connection.rollback();
        console.error('Loan approval error:', error);
        req.flash('error_msg', 'Failed to approve loan.');
        res.redirect('/admin/dashboard');
    } finally {
        connection.release();
    }
};

// Reject a loan
exports.rejectLoan = async (req, res) => {
    const { loanId } = req.params;
    try {
        await pool.query('UPDATE loans SET status = "REJECTED", decision_date = NOW() WHERE loan_id = ?', [loanId]);
        const [[user]] = await pool.query(`SELECT u.email FROM users u JOIN joint_members jm ON u.user_id = jm.user_id JOIN loans l ON jm.account_id = l.account_id WHERE l.loan_id = ? LIMIT 1`, [loanId])
        const [[loan]] = await pool.query('SELECT * FROM loans WHERE loan_id = ?', [loanId]);
        const { sendLoanStatusEmail } = require('../utils/mailer');
        await sendLoanStatusEmail(user.email, loan.loan_type, loan.amount, 'rejected');
        req.flash('success_msg', 'Loan rejected successfully!');
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Loan rejection error:', error);
        req.flash('error_msg', 'Failed to reject loan.');
        res.redirect('/admin/dashboard');
    }
};

// ... in adminController.js

// Search for an account and display its details
exports.searchAccount = async (req, res) => {
    const { accountNumber } = req.query;

    // If no accountNumber is provided, just render the page with a message
    if (!accountNumber) {
        return res.render('account-details', { 
            account: null, 
            searchAttempted: false 
        });
    }

    try {
        // 1. Find the account
        const [accountRows] = await pool.query('SELECT * FROM accounts WHERE account_number = ?', [accountNumber]);
        
        // If no account is found
        if (accountRows.length === 0) {
            return res.render('account-details', { 
                account: null, 
                searchAttempted: true, 
                searchedNumber: accountNumber 
            });
        }
        const account = accountRows[0];

        // 2. Get all members of the account
        const [members] = await pool.query(
            `SELECT u.first_name, u.last_name, u.email FROM users u 
             JOIN joint_members jm ON u.user_id = jm.user_id 
             WHERE jm.account_id = ?`,
            [account.account_id]
        );

        // 3. Get all loans for the account
        const [loans] = await pool.query('SELECT * FROM loans WHERE account_id = ? ORDER BY request_date DESC', [account.account_id]);

        // 4. Get all transactions for the account
        const [transactions] = await pool.query(
            'SELECT * FROM transactions WHERE from_account_id = ? OR to_account_id = ? ORDER BY timestamp DESC',
            [account.account_id, account.account_id]
        );
        
        // Render the results page with all the fetched data
        res.render('account-details', {
            account,
            members,
            loans,
            transactions,
            searchAttempted: true,
            searchedNumber: accountNumber
        });

    } catch (error) {
        console.error('Account search error:', error);
        res.status(500).send('Server Error');
    }
};

// --- ADVANCED INSIGHT QUERIES --- //

exports.showInsightsPage = (req, res) => {
    res.render('admin-insights', { results: null, title: 'Bank Insights', type: null });
};

// 1️⃣ Customers having more than X balance
exports.getHighBalanceCustomers = async (req, res) => {
    const { minBalance } = req.body;
    try {
        const [rows] = await pool.query(`
            SELECT 
                u.user_id,
                CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                a.account_number,
                a.account_type,
                a.balance
            FROM users u
            JOIN joint_members jm ON u.user_id = jm.user_id
            JOIN accounts a ON jm.account_id = a.account_id
            WHERE a.balance > ?
            ORDER BY a.balance DESC;
        `, [parseFloat(minBalance) || 0]);

        res.render('admin-insights', { 
            results: rows,
            title: `Customers with Balance > ${minBalance}`,
            type: 'high-balance'
        });

    } catch (err) {
        console.error('High balance query error:', err);
        res.status(500).send('Server Error');
    }
};


// Top transaction customers (fixed for ONLY_FULL_GROUP_BY)
exports.getTopTransactionCustomers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.user_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        GROUP_CONCAT(DISTINCT a.account_number SEPARATOR ', ') AS accounts,
        COUNT(t.transaction_id) AS total_transactions
      FROM users u
      JOIN joint_members jm ON u.user_id = jm.user_id
      JOIN accounts a ON jm.account_id = a.account_id
      JOIN transactions t ON (t.from_account_id = a.account_id OR t.to_account_id = a.account_id)
      GROUP BY u.user_id, u.first_name, u.last_name
      ORDER BY total_transactions DESC
      LIMIT 10;
    `);

    res.render('admin-insights', {
      results: rows,
      title: 'Top 10 Customers with Most Transactions',
      type: 'top-transactions'
    });
  } catch (error) {
    console.error('Top transactions query error:', error);
    res.status(500).send('Server Error');
  }
};

// Top loan customers (fixed / safer grouping)
exports.getTopLoanCustomers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.user_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        GROUP_CONCAT(DISTINCT a.account_number SEPARATOR ', ') AS accounts,
        IFNULL(SUM(l.amount), 0) AS total_approved_amount,
        COUNT(CASE WHEN l.status = 'APPROVED' THEN 1 END) AS approved_loans_count
      FROM users u
      JOIN joint_members jm ON u.user_id = jm.user_id
      JOIN accounts a ON jm.account_id = a.account_id
      LEFT JOIN loans l ON a.account_id = l.account_id AND l.status = 'APPROVED'
      GROUP BY u.user_id, u.first_name, u.last_name
      HAVING total_approved_amount > 0
      ORDER BY total_approved_amount DESC
      LIMIT 10;
    `);

    res.render('admin-insights', {
      results: rows,
      title: 'Top Loan Customers',
      type: 'top-loans'
    });
  } catch (error) {
    console.error('Top loans query error:', error);
    res.status(500).send('Server Error');
  }
};
