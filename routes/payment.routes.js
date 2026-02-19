const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorization = require('../middleware/authorization');
const {
    initializePayment,
    verifyPayment,
    paystackWebhook,
    flutterwaveWebhook,
    getBankDetails,
    uploadProof,
    verifyProof,
    getPendingVerifications
} = require('../controller/payment.controller');

// Initialize payment (Paystack or Flutterwave)
router.post('/initialize', initializePayment);

// Verify payment
router.get('/verify', verifyPayment);

// Webhook endpoints
router.post('/webhook/paystack', paystackWebhook);
router.post('/webhook/flutterwave', flutterwaveWebhook);

// Get bank account details
router.get('/bank-details', getBankDetails);

// Customer uploads payment proof (alternative to Cloudinary direct upload)
router.post('/upload-proof', uploadProof);

// Admin verifies payment proof
router.post('/verify-proof', verifyToken, authorization('Admin', 'Super Admin', 'Manager', 'CEO'), verifyProof);

// Admin gets pending verifications
router.get('/pending-verifications', verifyToken, authorization('Admin', 'Super Admin', 'Manager', 'CEO'), getPendingVerifications);

module.exports = router;
