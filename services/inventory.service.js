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
