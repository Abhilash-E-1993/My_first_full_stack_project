const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { protect } = require('../middleware/authMiddleware');
const { protectJoint } = require('../middleware/jointAuthMiddleware'); 

// Protect all routes in this file
router.use(protect);

// GET /account/dashboard
router.get('/dashboard', accountController.getDashboard);

router.get('/joint/create', protect, accountController.showCreateJointAccountPage);

// POST /account/deposit
router.post('/deposit', accountController.handleDeposit);
router.post('/joint/create', protect, accountController.handleCreateJointAccount);

// POST /account/withdraw
router.post('/withdraw', accountController.handleWithdrawal);

// POST /account/transfer
router.post('/transfer', accountController.handleTransfer);


// --- ADD THESE LOAN ROUTES FOR PRIMARY ACCOUNTS ---
// (These will be protected by the router.use(protect) at the top)
router.get('/loans/apply', accountController.showLoanApplicationPage);
router.post('/loans/apply', accountController.handleLoanApplication);


router.get('/joint/dashboard', protectJoint, accountController.getJointDashboard);

// Handle transactions for the joint account
router.post('/joint/deposit', protectJoint, accountController.handleJointDeposit);
router.post('/joint/withdraw', protectJoint, accountController.handleJointWithdrawal);
router.post('/joint/transfer', protectJoint, accountController.handleJointTransfer);


// --- ADD THESE LOAN ROUTES FOR JOINT ACCOUNTS ---
// (These will be protected by the router.use(protectJoint))
router.get('/joint/loans/apply', protectJoint, accountController.showJointLoanApplicationPage);
router.post('/joint/loans/apply', protectJoint, accountController.handleJointLoanApplication);


module.exports = router;