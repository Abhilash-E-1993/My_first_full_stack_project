const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/adminAuthMiddleware');

// Protect all routes in this file with the admin middleware
router.use(protectAdmin);

// GET /admin/dashboard
router.get('/dashboard', adminController.getAdminDashboard);

// POST /admin/loans/approve/:loanId
router.post('/loans/approve/:loanId', adminController.approveLoan);

// POST /admin/loans/reject/:loanId
router.post('/loans/reject/:loanId', adminController.rejectLoan);

// ... in adminRoutes.js, before module.exports
// GET /admin/search
router.get('/search', adminController.searchAccount);

// --- NEW INSIGHT ROUTES ---
router.get('/insights', adminController.showInsightsPage);
router.post('/insights/high-balance', adminController.getHighBalanceCustomers);
router.get('/insights/top-transactions', adminController.getTopTransactionCustomers);
router.get('/insights/top-loans', adminController.getTopLoanCustomers);

module.exports = router;