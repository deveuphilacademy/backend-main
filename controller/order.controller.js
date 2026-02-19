const Order = require("../model/Order");
const Product = require("../model/Products");
const inventoryService = require("../services/inventory.service");
const emailService = require("../services/email.service");

// addOrder
exports.addOrder = async (req, res, next) => {
  try {
    // 1. Validate stock before creation
    for (const item of req.body.cart) {
      if (!item.orderQuantity || typeof item.orderQuantity !== 'number' || item.orderQuantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid order quantity for ${item.title || 'product'}`,
        });
      }

      const product = await Product.findById(item._id).select("quantity title");
      if (!product || product.quantity < item.orderQuantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product ? product.title : 'product'}`,
        });
      }
    }

    const orderItems = await Order.create(req.body);

    // 2. Reduce stock after creation
    for (const item of req.body.cart) {
      try {
        await inventoryService.reduceStock(
          item._id,
          item.orderQuantity,
          orderItems._id
        );
        // 3. Increment sellCount
        await Product.findByIdAndUpdate(item._id, {
          $inc: { sellCount: item.orderQuantity },
        });
      } catch (stockError) {
        console.error(`Failed to reduce stock for ${item._id}:`, stockError);
      }
    }

    // 4. Send Order Confirmation Email (Fire-and-forget)
    if (orderItems.paymentMethod === 'bank-transfer') {
      setImmediate(() => {
        emailService.sendOrderConfirmation(orderItems)
          .then(() => console.log(`Order confirmation email sent for order: ${orderItems._id}`))
          .catch(err => console.error(`Error sending confirmation email for order ${orderItems._id}:`, err));
      });
    }

    res.status(200).json({
      success: true,
      message: "Order added successfully",
      order: orderItems,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
// get Orders
exports.getOrders = async (req, res, next) => {
  try {
    const orderItems = await Order.find({}).populate('user');
    res.status(200).json({
      success: true,
      data: orderItems,
    });
  }
  catch (error) {
    console.log(error);
    next(error)
  }
};
// get Orders
exports.getSingleOrder = async (req, res, next) => {
  try {
    const orderItem = await Order.findById(req.params.id).populate('user');
    res.status(200).json(orderItem);
  }
  catch (error) {
    console.log(error);
    next(error)
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  const newStatus = req.body.status;
  try {
    await Order.updateOne(
      {
        _id: req.params.id,
      },
      {
        $set: {
          status: newStatus,
        },
      },
      { new: true }
    );

    // Stock restoration on cancellation
    if (newStatus === "cancel") {
      const order = await Order.findById(req.params.id);
      if (order && order.cart) {
        for (const item of order.cart) {
          try {
            await inventoryService.restoreStock(
              item._id,
              item.orderQuantity,
              req.params.id
            );
          } catch (restoreError) {
            console.error(
              `Failed to restore stock for ${item._id}:`,
              restoreError
            );
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
