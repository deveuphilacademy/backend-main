const { renderTemplate } = require('../config/email');
const { secret } = require('../config/secret');
const emailQueue = require('../jobs/email.queue');

/**
 * Build an HTML table for cart items.
 * @param {Array} cart - Array of cart items.
 * @returns {string} HTML table string.
 */
const buildCartItemsHtml = (cart) => {
    if (!cart || cart.length === 0) return '';

    let html = `
        <table class="cart-table" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 12px; border-bottom: 1px solid #eee; background: #f8f9fa;">Item</th>
                    <th style="text-align: left; padding: 12px; border-bottom: 1px solid #eee; background: #f8f9fa;">Qty</th>
                    <th style="text-align: left; padding: 12px; border-bottom: 1px solid #eee; background: #f8f9fa;">Price</th>
                </tr>
            </thead>
            <tbody>
    `;

    cart.forEach(item => {
        html += `
            <tr>
                <td style="text-align: left; padding: 12px; border-bottom: 1px solid #eee;">${item.title}</td>
                <td style="text-align: left; padding: 12px; border-bottom: 1px solid #eee;">${item.orderQuantity}</td>
                <td style="text-align: left; padding: 12px; border-bottom: 1px solid #eee;">₦${item.price.toLocaleString()}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;
    return html;
};

/**
 * Send order confirmation email for bank transfers.
 * @param {Object} order - The order document.
 */
exports.sendOrderConfirmation = async (order) => {
    const variables = {
        name: order.name,
        invoice: order.invoice || order._id.toString().slice(-6).toUpperCase(),
        totalAmount: order.totalAmount.toLocaleString(),
        bankName: secret.bank_name,
        accountName: secret.account_name,
        accountNumber: secret.account_number,
        cartItems: buildCartItemsHtml(order.cart),
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString(),
        uploadProofUrl: `${secret.client_url}/order/${order._id}`,
        trackingUrl: `${secret.client_url}/order/${order._id}`
    };

    const html = renderTemplate('order-confirmation-bank-transfer', variables);

    return await emailQueue.add({
        to: order.email,
        subject: `Pending Payment: Order #${variables.invoice}`,
        html
    });
};

/**
 * Send acknowledgement when payment proof is uploaded.
 * @param {Object} order - The order document.
 */
exports.sendPaymentProofReceived = async (order) => {
    const variables = {
        name: order.name,
        invoice: order.invoice || order._id.toString().slice(-6).toUpperCase(),
        totalAmount: order.totalAmount.toLocaleString(),
        trackingUrl: `${secret.client_url}/order/${order._id}`
    };

    const html = renderTemplate('payment-proof-received', variables);

    return await emailQueue.add({
        to: order.email,
        subject: `Payment Proof Received: Order #${variables.invoice}`,
        html
    });
};

/**
 * Send confirmation when payment is verified.
 * @param {Object} order - The order document.
 */
exports.sendPaymentVerified = async (order) => {
    const variables = {
        name: order.name,
        invoice: order.invoice || order._id.toString().slice(-6).toUpperCase(),
        totalAmount: order.totalAmount.toLocaleString(),
        cartItems: buildCartItemsHtml(order.cart),
        address: `${order.address}, ${order.city}, ${order.country}`,
        trackingUrl: `${secret.client_url}/order/${order._id}`
    };

    const html = renderTemplate('payment-verified', variables);

    return await emailQueue.add({
        to: order.email,
        subject: `Payment Confirmed: Order #${variables.invoice}`,
        html
    });
};

/**
 * Send rejection notice when payment proof is rejected.
 * @param {Object} order - The order document.
 */
exports.sendPaymentRejected = async (order) => {
    const variables = {
        name: order.name,
        invoice: order.invoice || order._id.toString().slice(-6).toUpperCase(),
        rejectionReason: order.paymentProof.rejectionReason || 'Unable to verify payment details.',
        supportEmail: secret.email_user,
        trackingUrl: `${secret.client_url}/order/${order._id}`
    };

    const html = renderTemplate('payment-rejected', variables);

    return await emailQueue.add({
        to: order.email,
        subject: `Payment Disapproved: Order #${variables.invoice}`,
        html
    });
};

/**
 * Send stock alerts to admins.
 * @param {Object} product - The product document.
 * @param {string} type - 'low-stock' or 'out-of-stock'.
 */
exports.sendStockAlert = async (product, type) => {
    const templateName = type === 'out-of-stock' ? 'out-of-stock-alert' : 'low-stock-alert';
    const subject = type === 'out-of-stock'
        ? `URGENT: Out of Stock Alert - ${product.title}`
        : `Low Stock Alert - ${product.title}`;

    const variables = {
        productName: product.title,
        currentQuantity: product.quantity,
        threshold: product.lowStockThreshold || 0,
        adminUrl: secret.admin_url
    };

    const html = renderTemplate(templateName, variables);

    return await emailQueue.add({
        to: secret.admin_notification_email,
        subject,
        html
    });
};
