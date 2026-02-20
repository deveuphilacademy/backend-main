const Products = require("../model/Products");

/**
 * Reduces stock quantity for a product and records a sale entry.
 * @param {string} productId - The ID of the product.
 * @param {number} quantity - The quantity to reduce.
 * @param {string} orderId - The ID of the associated order.
 * @returns {Promise<Object>} The updated product.
 */
exports.reduceStock = async (productId, quantity, orderId) => {
    const product = await Products.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }

    if (product.quantity < quantity) {
        throw new Error(`Insufficient stock for ${product.title}`);
    }

    const newQty = product.quantity - quantity;
    const statusUpdate = newQty <= 0 ? "out-of-stock" : product.status;

    const updatedProduct = await Products.findByIdAndUpdate(
        productId,
        {
            $inc: { quantity: -quantity },
            $push: {
                stockHistory: {
                    quantity: -quantity,
                    action: "sale",
                    orderId,
                    timestamp: Date.now(),
                },
            },
            $set: { status: statusUpdate },
        },
        { new: true }
    );

    // Trigger notifications
    try {
        const notificationService = require("./notification.service");
        const admins = await notificationService.getAllAdmins();

        if (updatedProduct.quantity === 0) {
            await notificationService.createStockAlert(updatedProduct, "out-of-stock");
            await notificationService.sendOutOfStockEmail(updatedProduct, admins);
        } else if (updatedProduct.quantity <= updatedProduct.lowStockThreshold) {
            await notificationService.createStockAlert(updatedProduct, "low-stock");
            await notificationService.sendLowStockEmail(updatedProduct, admins);
        }
    } catch (error) {
        console.error("Notification trigger failed:", error);
    }

    return updatedProduct;
};

/**
 * Restores stock quantity for a product (e.g., on cancellation) and records a entry.
 * @param {string} productId - The ID of the product.
 * @param {number} quantity - The quantity to restore.
 * @param {string} orderId - The ID of the associated order.
 * @returns {Promise<Object>} The updated product.
 */
exports.restoreStock = async (productId, quantity, orderId) => {
    const product = await Products.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }

    const newQty = product.quantity + quantity;
    let statusUpdate = product.status;
    if (newQty > 0 && product.status === "out-of-stock") {
        statusUpdate = "in-stock";
    }

    const updatedProduct = await Products.findByIdAndUpdate(
        productId,
        {
            $inc: { quantity: quantity },
            $push: {
                stockHistory: {
                    quantity: quantity,
                    action: "cancelled-order",
                    orderId,
                    timestamp: Date.now(),
                },
            },
            $set: { status: statusUpdate },
        },
        { new: true }
    );

    // Handle restock notifications (transition from out-of-stock to in-stock)
    if (statusUpdate === "in-stock" && product.status === "out-of-stock" && updatedProduct.notifyList.length > 0) {
        try {
            const { sendEmailStandalone } = require("../config/email");
            const notifications = updatedProduct.notifyList.map(item => ({
                from: process.env.EMAIL_USER,
                to: item.email,
                subject: `Restock Alert: ${updatedProduct.title} is back in stock!`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Good news!</h2>
                        <p>The product you were waiting for, <strong>${updatedProduct.title}</strong>, is now back in stock.</p>
                        <p>Quantity available: ${updatedProduct.quantity}</p>
                        <a href="${process.env.STORE_URL}/product/${updatedProduct._id}" style="display: inline-block; padding: 10px 20px; background-color: #0171e2; color: #fff; text-decoration: none; border-radius: 5px;">Shop Now</a>
                    </div>
                `
            }));

            // Send emails in batches or sequentially
            await Promise.allSettled(notifications.map(mailOptions => sendEmailStandalone(mailOptions)));

            // Clear notify list after sending
            await Products.findByIdAndUpdate(productId, { $set: { notifyList: [] } });
        } catch (error) {
            console.error("Failed to send restock notifications in restoreStock:", error);
        }
    }

    return updatedProduct;
};

/**
 * Manually adjusts stock or restocks a product.
 * @param {string} productId - The ID of the product.
 * @param {number} quantity - The quantity to adjust (can be negative for adjustment).
 * @param {string} action - 'restock' or 'adjustment'.
 * @param {string} adminId - The ID of the admin making the change.
 * @param {string} note - Optional note.
 * @returns {Promise<Object>} The updated product.
 */
exports.adjustStock = async (productId, quantity, action, adminId, note) => {
    const product = await Products.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }

    if (action === "restock" && quantity <= 0) {
        throw new Error("Restock quantity must be greater than zero");
    }

    const newQty = product.quantity + quantity;
    if (newQty < 0) {
        throw new Error("Inventory quantity cannot be negative");
    }

    let statusUpdate = newQty <= 0 ? "out-of-stock" : product.status;
    if (newQty > 0 && product.status === "out-of-stock") {
        statusUpdate = "in-stock";
    }

    const updateObj = {
        $inc: { quantity: quantity },
        $push: {
            stockHistory: {
                quantity: quantity,
                action: action,
                adminId,
                note,
                timestamp: Date.now(),
            },
        },
        $set: { status: statusUpdate },
    };

    if (action === "restock") {
        updateObj.$set.lastRestocked = Date.now();
    }

    const updatedProduct = await Products.findByIdAndUpdate(productId, updateObj, {
        new: true,
    });

    // Handle restock notifications
    if (statusUpdate === "in-stock" && product.status === "out-of-stock" && updatedProduct.notifyList.length > 0) {
        try {
            const { sendEmailStandalone } = require("../config/email");
            const notifications = updatedProduct.notifyList.map(item => ({
                from: process.env.EMAIL_USER,
                to: item.email,
                subject: `Restock Alert: ${updatedProduct.title} is back in stock!`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Good news!</h2>
                        <p>The product you were waiting for, <strong>${updatedProduct.title}</strong>, is now back in stock.</p>
                        <p>Quantity available: ${updatedProduct.quantity}</p>
                        <a href="${process.env.STORE_URL}/product/${updatedProduct._id}" style="display: inline-block; padding: 10px 20px; background-color: #0171e2; color: #fff; text-decoration: none; border-radius: 5px;">Shop Now</a>
                    </div>
                `
            }));

            // Send emails in batches or sequentially
            await Promise.allSettled(notifications.map(mailOptions => sendEmailStandalone(mailOptions)));

            // Clear notify list after sending
            await Products.findByIdAndUpdate(productId, { $set: { notifyList: [] } });
        } catch (error) {
            console.error("Failed to send restock notifications:", error);
        }
    }

    return updatedProduct;
};

/**
 * Finds all products where quantity is less than or equal to lowStockThreshold.
 * @returns {Promise<Array>} List of low stock products.
 */
exports.checkLowStock = async () => {
    return await Products.find({
        $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
        status: { $ne: "discontinued" },
    });
};

/**
 * Gets the stock history of a specific product.
 * @param {string} productId - The ID of the product.
 * @returns {Promise<Object>} Product with stock history.
 */
exports.getStockHistory = async (productId) => {
    return await Products.findById(productId).select(
        "stockHistory title quantity status"
    );
};

/**
 * Gets the most recent stock changes across all products.
 * @returns {Promise<Array>} List of recent stock changes.
 */
exports.getRecentStockChanges = async () => {
    const recentChanges = await Products.aggregate([
        { $unwind: "$stockHistory" },
        { $sort: { "stockHistory.timestamp": -1 } },
        { $limit: 20 },
        {
            $project: {
                _id: "$stockHistory._id", // Use stockHistory entry ID if available, or just ignore
                productId: "$_id",
                productName: "$title",
                action: "$stockHistory.action",
                quantity: "$stockHistory.quantity",
                timestamp: "$stockHistory.timestamp",
                note: "$stockHistory.note",
                adminId: "$stockHistory.adminId",
                orderId: "$stockHistory.orderId",
            }
        }
    ]);
    return recentChanges;
};
