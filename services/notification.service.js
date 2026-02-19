const Notification = require("../model/Notification");
const Admin = require("../model/Admin");
const { sendEmailStandalone } = require("../config/email");
const { secret } = require("../config/secret");

/**
 * Fetches all active admins.
 * @returns {Promise<Array>} List of active admins.
 */
exports.getAllAdmins = async () => {
    return await Admin.find({ status: 'Active' }).select('_id email name');
};

/**
 * Creates a stock alert notification for admins.
 * @param {Object} product - The product document.
 * @param {string} type - 'low-stock' or 'out-of-stock'.
 * @returns {Promise<Object|null>} The created notification or null if deduplicated.
 */
exports.createStockAlert = async (product, type) => {
    // Deduplication logic: skip if an unread notification of same type exists for this product in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingNotification = await Notification.findOne({
        productId: product._id,
        type,
        createdAt: { $gte: twentyFourHoursAgo }
    });

    if (existingNotification) return null;

    const admins = await exports.getAllAdmins();
    const adminIds = admins.map(admin => admin._id);

    const message = type === 'out-of-stock'
        ? `Product "${product.title}" is out of stock!`
        : `Product "${product.title}" is low on stock (${product.quantity} remaining).`;

    const priority = type === 'out-of-stock' ? 'urgent' : 'high';

    const notification = new Notification({
        type,
        productId: product._id,
        message,
        recipients: adminIds,
        priority,
        metadata: {
            currentQuantity: product.quantity,
            threshold: product.lowStockThreshold,
            productName: product.title
        }
    });

    return await notification.save();
};

/**
 * Sends a low stock email to admins.
 * @param {Object} product - The product document.
 * @param {Array} admins - List of admin objects.
 */
exports.sendLowStockEmail = async (product, admins) => {
    const adminEmails = admins.map(a => a.email).join(', ');
    const recipient = secret.admin_notification_email || adminEmails;

    const body = {
        from: secret.email_user,
        to: recipient,
        subject: `Low Stock Alert: ${product.title}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px;">
                <h3 style="color: #333;">Low Stock Alert</h3>
                <p>Hello Admin,</p>
                <p>The following product has reached its low stock threshold:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Product Name</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${product.title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Current Quantity</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${product.quantity}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Low Stock Threshold</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${product.lowStockThreshold}</td>
                    </tr>
                </table>
                <p>Please consider restocking soon.</p>
                <p>Regards,<br/>Inventory Management System</p>
            </div>
        `
    };

    try {
        await sendEmailStandalone(body);
    } catch (error) {
        console.error("Failed to send low stock email:", error);
    }
};

/**
 * Sends an out of stock email to admins.
 * @param {Object} product - The product document.
 * @param {Array} admins - List of admin objects.
 */
exports.sendOutOfStockEmail = async (product, admins) => {
    const adminEmails = admins.map(a => a.email).join(', ');
    const recipient = secret.admin_notification_email || adminEmails;

    const body = {
        from: secret.email_user,
        to: recipient,
        subject: `URGENT: Out of Stock Alert: ${product.title}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #d9534f;">Out of Stock Alert</h2>
                <p>Hello Admin,</p>
                <p>The following product is now <strong>OUT OF STOCK</strong>:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Product Name</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${product.title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Status</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; color: #d9534f; font-weight: bold;">Out of Stock</td>
                    </tr>
                </table>
                <p>Customers will no longer be able to purchase this item until it is restocked.</p>
                <p>Regards,<br/>Inventory Management System</p>
            </div>
        `
    };

    try {
        await sendEmailStandalone(body);
    } catch (error) {
        console.error("Failed to send out of stock email:", error);
    }
};

/**
 * Marks a notification as read by an admin.
 * @param {string} notificationId - The notification ID.
 * @param {string} adminId - The admin ID.
 */
exports.markAsRead = async (notificationId, adminId) => {
    const notification = await Notification.findById(notificationId);
    if (!notification) throw new Error("Notification not found");
    return await notification.markAsReadBy(adminId);
};

/**
 * Periodic check for low stock products and notification dispatch.
 */
exports.checkAndNotifyLowStock = async () => {
    try {
        // Dynamic require to avoid circular dependency
        const inventoryService = require("./inventory.service");
        const lowStockProducts = await inventoryService.checkLowStock();
        const admins = await exports.getAllAdmins();

        if (lowStockProducts.length === 0) return;

        for (const product of lowStockProducts) {
            const type = product.quantity === 0 ? 'out-of-stock' : 'low-stock';

            // Create in-app notification
            await exports.createStockAlert(product, type);

            // Send email notification
            if (type === 'out-of-stock') {
                await exports.sendOutOfStockEmail(product, admins);
            } else {
                await exports.sendLowStockEmail(product, admins);
            }
        }
    } catch (error) {
        console.error("Error in checkAndNotifyLowStock job:", error);
    }
};
