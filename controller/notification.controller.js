const Notification = require("../model/Notification");
const notificationService = require("../services/notification.service");

/**
 * Fetches all notifications for the logged-in admin.
 */
exports.getNotifications = async (req, res, next) => {
    try {
        const { read, page = 1, limit = 20 } = req.query;
        // User ID from verifyToken middleware
        const query = { recipients: req.user._id };

        if (read !== undefined) {
            const isRead = read === 'true';
            if (isRead) {
                // Documents where readBy contains an entry for this admin
                query['readBy.adminId'] = req.user._id;
            } else {
                // Documents where readBy does NOT contain an entry for this admin
                query.readBy = { $not: { $elemMatch: { adminId: req.user._id } } };
            }
        }

        const total = await Notification.countDocuments(query);
        const pages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('productId', 'title quantity status');

        res.status(200).json({
            success: true,
            data: notifications,
            total,
            page: parseInt(page),
            pages
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Marks a specific notification as read by the admin.
 */
exports.markNotificationRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        await notificationService.markAsRead(id, req.user._id);
        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Gets the count of unread notifications for the logged-in admin.
 */
exports.getUnreadCount = async (req, res, next) => {
    try {
        const count = await Notification.countDocuments({
            recipients: req.user._id,
            readBy: { $not: { $elemMatch: { adminId: req.user._id } } }
        });
        res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        next(error);
    }
};
