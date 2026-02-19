const Order = require("../model/Order");
const Product = require("../model/Products");

exports.getDashboardAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));

        const dateFilter = {
            createdAt: {
                $gte: start,
                $lte: end,
            },
        };

        const [
            paymentBreakdown,
            orderStatusBreakdown,
            salesTrend,
            topSellingProducts,
            inventoryStats,
            pendingVerifications,
        ] = await Promise.all([
            // Payment breakdown
            Order.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$paymentMethod",
                        totalAmount: { $sum: "$totalAmount" },
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        paymentMethod: "$_id",
                        totalAmount: 1,
                        count: 1,
                    },
                },
            ]),

            // Order status breakdown
            Order.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        status: "$_id",
                        count: 1,
                    },
                },
            ]),

            // Sales trend
            Order.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                        },
                        total: { $sum: "$totalAmount" },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                {
                    $project: {
                        _id: 0,
                        date: "$_id",
                        total: 1,
                        orders: 1,
                    },
                },
            ]),

            // Top selling products
            Order.aggregate([
                { $match: dateFilter },
                { $unwind: "$cart" },
                {
                    $group: {
                        _id: {
                            id: "$cart._id",
                            title: "$cart.title",
                        },
                        orderQuantity: { $sum: "$cart.orderQuantity" },
                    },
                },
                { $sort: { orderQuantity: -1 } },
                { $limit: 5 },
                {
                    $project: {
                        _id: 0,
                        id: "$_id.id",
                        title: "$_id.title",
                        orderQuantity: 1,
                    },
                },
            ]),

            // Inventory stats
            Product.aggregate([
                {
                    $facet: {
                        totalProducts: [{ $count: "count" }],
                        lowStock: [
                            {
                                $match: {
                                    $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
                                    status: { $ne: "out-of-stock" },
                                },
                            },
                            { $count: "count" },
                        ],
                        outOfStock: [
                            { $match: { status: "out-of-stock" } },
                            { $count: "count" },
                        ],
                        totalInventoryValue: [
                            {
                                $group: {
                                    _id: null,
                                    totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
                                },
                            },
                        ],
                        lowStockProducts: [
                            {
                                $match: {
                                    $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
                                },
                            },
                            { $sort: { quantity: 1 } },
                            { $limit: 5 },
                            {
                                $project: {
                                    _id: 1,
                                    title: 1,
                                    quantity: 1,
                                    lowStockThreshold: 1,
                                },
                            },
                        ],
                    },
                },
            ]),

            // Pending verifications
            Order.countDocuments({ paymentStatus: "verifying" }),
        ]);

        const formattedInventoryStats = {
            totalProducts: inventoryStats[0].totalProducts[0]?.count || 0,
            lowStock: inventoryStats[0].lowStock[0]?.count || 0,
            outOfStock: inventoryStats[0].outOfStock[0]?.count || 0,
            totalInventoryValue: inventoryStats[0].totalInventoryValue[0]?.totalValue || 0,
            lowStockProducts: inventoryStats[0].lowStockProducts || [],
        };

        res.status(200).json({
            success: true,
            data: {
                paymentBreakdown,
                orderStatusBreakdown,
                salesTrend,
                topSellingProducts,
                inventoryStats: formattedInventoryStats,
                pendingVerifications,
            },
        });
    } catch (error) {
        console.error("Dashboard Analytics Error:", error);
        next(error);
    }
};
