const crypto = require('crypto');
const Order = require('../model/Order');
const paymentServices = require('../services/payment.service');
const { secret } = require('../config/secret');

// Initialize Payment
exports.initializePayment = async (req, res, next) => {
    try {
        const { orderId, gateway } = req.body;

        const order = await Order.findById(orderId).populate('cart.id'); // Assuming cart.id references Product
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        // Generate unique payment reference
        const timestamp = Date.now();
        const reference = `ORD-${order.invoice || order._id}-${timestamp}`;

        const orderData = {
            email: order.user ? order.user.email : req.body.email, // Adjust based on where email is stored
            amount: order.totalAmount,
            reference,
            orderId: order._id,
            cart: order.cart,
            name: order.name,
            phone: order.address ? order.address.phone : '', // Adjust based on address structure
        };

        let paymentData;
        if (gateway === 'paystack') {
            paymentData = await paymentServices.initializePaystack(orderData);
        } else if (gateway === 'flutterwave') {
            paymentData = await paymentServices.initializeFlutterwave(orderData);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment gateway',
            });
        }

        // Update order with payment details
        order.paymentMethod = gateway;
        order.paymentReference = reference;
        await order.save();

        res.status(200).json({
            success: true,
            data: paymentData,
            reference,
        });
    } catch (error) {
        next(error);
    }
};

// Verify Payment
exports.verifyPayment = async (req, res, next) => {
    try {
        const { reference, gateway, transaction_id, status, tx_ref } = req.query;

        // Handle Flutterwave redirect query params
        const effectiveReference = reference || tx_ref;
        const effectiveGateway = gateway || (tx_ref ? 'flutterwave' : 'paystack');

        // Find order
        const order = await Order.findOne({ paymentReference: effectiveReference });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found for this reference',
            });
        }

        if (order.paymentStatus === 'paid') {
            return res.status(200).json({
                success: true,
                message: 'Payment already verified',
                data: order,
            });
        }

        let verificationData;
        let isSuccess = false;

        if (effectiveGateway === 'paystack') {
            verificationData = await paymentServices.verifyPaystack(effectiveReference);

            // Validate amount (kobo) and currency
            const amountInKobo = Math.round(order.totalAmount * 100);
            if (verificationData.status === 'success' &&
                verificationData.amount >= amountInKobo &&
                verificationData.currency === 'NGN') {
                isSuccess = true;
            }

        } else if (effectiveGateway === 'flutterwave') {
            // Flutterwave verification typically needs transaction_id
            // If returning from redirect, transaction_id is in query
            const verifyId = transaction_id || req.query.transaction_id;
            verificationData = await paymentServices.verifyFlutterwave(verifyId);
            isSuccess = verificationData.status === 'successful' &&
                verificationData.amount >= order.totalAmount &&
                verificationData.currency === 'NGN';
        }

        if (isSuccess) {
            order.paymentStatus = 'paid';
            order.status = 'processing';
            order.paymentVerifiedAt = new Date();
            order.paymentProof = JSON.stringify(verificationData); // Store basic proof
            await order.save();

            res.status(200).json({
                success: true,
                message: 'Payment verified successfully',
                data: order,
            });
        } else {
            order.paymentStatus = 'failed';
            await order.save();

            res.status(400).json({
                success: false,
                message: 'Payment verification failed',
            });
        }
    } catch (error) {
        next(error);
    }
};

// Start Paystack Webhook
exports.paystackWebhook = async (req, res) => {
    try {
        const hash = crypto.createHmac('sha512', secret.paystack_secret_key).update(JSON.stringify(req.body)).digest('hex');

        if (hash === req.headers['x-paystack-signature']) {
            const event = req.body;

            if (event.event === 'charge.success') {
                const reference = event.data.reference;
                const order = await Order.findOne({ paymentReference: reference });

                if (order && order.paymentStatus !== 'paid') {
                    // Validate amount (kobo) and currency
                    const amountInKobo = Math.round(order.totalAmount * 100);
                    if (event.data.amount >= amountInKobo && event.data.currency === 'NGN') {
                        order.paymentStatus = 'paid';
                        order.status = 'processing';
                        order.paymentVerifiedAt = new Date();
                        await order.save();
                    }
                }
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Paystack webhook error:', error);
        res.sendStatus(200); // Always return 200 to acknowledge receipt
    }
};

// Start Flutterwave Webhook
exports.flutterwaveWebhook = async (req, res) => {
    try {
        const signature = req.headers['verif-hash'];
        if (!signature || signature !== secret.flw_webhook_hash) {
            return res.status(401).end();
        }

        const payload = req.body;

        if (payload.status === 'successful') {
            const transactionId = payload.id;
            // Verify transaction to be sure
            const verification = await paymentServices.verifyFlutterwave(transactionId);

            if (verification.status === 'successful' && verification.amount) {
                const reference = verification.tx_ref;
                const order = await Order.findOne({ paymentReference: reference });

                if (order && order.paymentStatus !== 'paid' && verification.amount >= order.totalAmount) {
                    order.paymentStatus = 'paid';
                    order.status = 'processing';
                    order.paymentVerifiedAt = new Date();
                    await order.save();
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Flutterwave webhook error:', error);
        res.sendStatus(200);
    }
};

// Get Bank Details
exports.getBankDetails = (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            bankName: secret.bank_name,
            accountName: secret.account_name,
            accountNumber: secret.account_number,
        },
    });
};

// Customer uploads payment proof (alternative to Cloudinary direct upload)
exports.uploadProof = async (req, res, next) => {
    try {
        const { orderId, imageUrl, bankTransferDetails } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        if (order.paymentMethod !== 'bank-transfer') {
            return res.status(400).json({
                success: false,
                message: 'Order is not a bank transfer order',
            });
        }

        if (order.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Order is already paid',
            });
        }

        // Update order
        if (imageUrl) {
            order.paymentProof = {
                ...order.paymentProof,
                imageUrl,
                uploadedAt: new Date(),
            };
        }

        if (bankTransferDetails) {
            order.bankTransferDetails = bankTransferDetails;
        }

        order.paymentStatus = 'verifying';

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Payment proof uploaded successfully',
            data: order,
        });
    } catch (error) {
        next(error);
    }
};

// Admin verifies payment proof
exports.verifyProof = async (req, res, next) => {
    try {
        const { orderId, action, rejectionReason } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action',
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        if (order.paymentStatus !== 'verifying') {
            return res.status(400).json({
                success: false,
                message: `Order status is ${order.paymentStatus}, cannot verify. Only 'verifying' status is allowed.`,
            });
        }

        const updatedProof = {
            ...order.paymentProof,
            verifiedBy: req.user._id,
            verifiedAt: new Date(),
        };

        if (action === 'approve') {
            order.paymentStatus = 'paid';
            order.status = 'processing';
            order.paymentVerifiedAt = new Date();
            order.paymentProof = updatedProof;
        } else if (action === 'reject') {
            if (!rejectionReason) {
                return res.status(400).json({
                    success: false,
                    message: 'Rejection reason is required',
                });
            }
            order.paymentStatus = 'rejected';
            updatedProof.rejectionReason = rejectionReason;
            order.paymentProof = updatedProof;
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: `Payment ${action}d successfully`,
            data: order,
        });
    } catch (error) {
        next(error);
    }
};

// Admin gets pending verifications
exports.getPendingVerifications = async (req, res, next) => {
    try {
        const orders = await Order.find({ paymentStatus: 'verifying' })
            .populate('user', 'name email')
            .sort({ 'paymentProof.uploadedAt': -1 });

        res.status(200).json({
            success: true,
            data: orders,
        });
    } catch (error) {
        next(error);
    }
};
