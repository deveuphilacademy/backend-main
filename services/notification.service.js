const Notification = require("../model/Notification");
const Admin = require("../model/Admin");
const emailService = require("./email.service");
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
    try {
        await emailService.sendStockAlert(product, 'low-stock');
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
    try {
        await emailService.sendStockAlert(product, 'out-of-stock');
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

            // Send email notification (Fire-and-forget)
            setImmediate(() => {
                emailService.sendStockAlert(product, type)
                    .catch(err => console.error(`Error sending stock alert for ${product.title}:`, err));
            });
        }
    } catch (error) {
        console.error("Error in checkAndNotifyLowStock job:", error);
    }
};
