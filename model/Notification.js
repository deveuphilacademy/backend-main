const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ['low-stock', 'out-of-stock', 'restock-reminder', 'payment-verification'],
            lowercase: true
        },
        productId: {
            type: ObjectId,
            ref: 'Products',
            required: false // Not required for payment notifications
        },
        orderId: {
            type: ObjectId,
            ref: 'Order',
            required: false // Required for payment verification notifications
        },
        message: {
            type: String,
            required: true,
            maxLength: [500, "Message is too long"]
        },
        read: {
            type: Boolean,
            default: false,
            required: true
        },
        recipients: [{
            type: ObjectId,
            ref: 'Admin',
            required: true
        }],
        metadata: {
            currentQuantity: Number,
            threshold: Number,
            productName: String,
            orderInvoice: Number
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium',
            lowercase: true
        },
        readBy: [{
            adminId: {
                type: ObjectId,
                ref: 'Admin'
            },
            readAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    {
        timestamps: true
    }
);

// Indexes for performance optimization
notificationSchema.index({ read: 1, createdAt: -1 }); // For unread notifications
notificationSchema.index({ recipients: 1, read: 1 }); // For user-specific notifications
notificationSchema.index({ type: 1, createdAt: -1 }); // For filtering by notification type
notificationSchema.index({ productId: 1 }); // For product-specific notifications
notificationSchema.index({ orderId: 1 }); // For order-specific notifications

// Method to mark notification as read by a specific admin
notificationSchema.methods.markAsReadBy = function (adminId) {
    if (!this.readBy.some(r => r.adminId.equals(adminId))) {
        this.readBy.push({ adminId, readAt: new Date() });
    }
    // Mark as fully read if all recipients have read it
    if (this.readBy.length >= this.recipients.length) {
        this.read = true;
    }
    return this.save();
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
