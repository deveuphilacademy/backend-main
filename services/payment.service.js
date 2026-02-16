const Paystack = require('paystack');
const Flutterwave = require('flutterwave-node-v3');
const { secret } = require('../config/secret');

// Initialize payment gateways
const paystack = Paystack(secret.paystack_secret_key);
const flw = new Flutterwave(secret.flw_public_key, secret.flw_secret_key);

const paymentServices = {
    // Paystack Services
    initializePaystack: async (orderData) => {
        try {
            const { email, amount, reference, orderId, cart, name, phone } = orderData;

            const response = await paystack.transaction.initialize({
                email,
                amount: Math.round(amount * 100), // Convert to kobo
                reference,
                currency: 'NGN',
                callback_url: `${secret.client_url}/payment/verify`,
                metadata: {
                    orderId,
                    name,
                    phone,
                    cart_items: cart.map(item => ({
                        product_id: item._id,
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            });

            return response.data;
        } catch (error) {
            console.error('Paystack initialization error:', error);
            throw new Error(`Paystack initialization failed: ${error.message}`);
        }
    },

    verifyPaystack: async (reference) => {
        try {
            const response = await paystack.transaction.verify(reference);
            return response.data;
        } catch (error) {
            console.error('Paystack verification error:', error);
            throw new Error(`Paystack verification failed: ${error.message}`);
        }
    },

    // Flutterwave Services
    initializeFlutterwave: async (orderData) => {
        try {
            const { email, amount, reference, orderId, cart, name, phone } = orderData;

            const payload = {
                tx_ref: reference,
                amount,
                currency: 'NGN',
                redirect_url: `${secret.client_url}/payment/verify`,
                payment_options: 'card,banktransfer,ussd',
                customer: {
                    email,
                    phonenumber: phone,
                    name,
                },
                customizations: {
                    title: 'Euphil Foods Payment',
                    description: `Payment for Order #${orderId}`,
                    logo: 'https://res.cloudinary.com/your-cloud-name/image/upload/v1/logo.png', // Replace with actual logo URL
                },
                meta: {
                    orderId,
                    cart_items: JSON.stringify(cart.map(item => ({
                        product_id: item._id,
                        quantity: item.quantity,
                        price: item.price
                    })))
                }
            };

            const response = await flw.Payment.standard(payload);

            if (response.status === 'success') {
                return {
                    authorization_url: response.data.link,
                    access_code: reference // Flutterwave doesn't use access code like Paystack, but we return ref for consistency
                };
            } else {
                throw new Error(response.message || 'Failed to initialize Flutterwave payment');
            }
        } catch (error) {
            console.error('Flutterwave initialization error:', error);
            throw new Error(`Flutterwave initialization failed: ${error.message}`);
        }
    },

    verifyFlutterwave: async (transactionId) => {
        try {
            const response = await flw.Transaction.verify({ id: transactionId });
            return response.data;
        } catch (error) {
            console.error('Flutterwave verification error:', error);
            throw new Error(`Flutterwave verification failed: ${error.message}`);
        }
    }
};

module.exports = paymentServices;
