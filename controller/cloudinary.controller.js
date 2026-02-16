const fs = require("fs");
const { cloudinaryServices } = require("../services/cloudinary.service");
const Order = require("../model/Order");

// add image
const saveImageCloudinary = async (req, res, next) => {
  // console.log(req.file)
  try {
    const result = await cloudinaryServices.cloudinaryImageUpload(
      req.file.buffer
    );
    res.status(200).json({
      success: true,
      message: "image uploaded successfully",
      data: { url: result.secure_url, id: result.public_id },
    });
  } catch (err) {
    console.log(err);
    next(err)
  }
};

// add image
const addMultipleImageCloudinary = async (req, res) => {
  try {
    const files = req.files;

    // Array to store Cloudinary image upload responses
    const uploadResults = [];

    for (const file of files) {
      // Upload image to Cloudinary
      const result = await cloudinaryServices.cloudinaryImageUpload(file.path);

      // Store the Cloudinary response in the array
      uploadResults.push(result);
    }

    // Delete temporary local files
    for (const file of files) {
      fs.unlinkSync(file.path);
    }

    res.status(200).json({
      success: true,
      message: "image uploaded successfully",
      data:
        uploadResults.length > 0
          ? uploadResults.map((res) => ({
            url: res.secure_url,
            id: res.public_id,
          }))
          : [],
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      message: "Failed to upload image",
    });
  }
};

// cloudinary ImageDelete
const cloudinaryDeleteController = async (req, res) => {
  try {
    const { folder_name, id } = req.query;
    const public_id = `${folder_name}/${id}`;
    const result = await cloudinaryServices.cloudinaryImageDelete(public_id);
    res.status(200).json({
      success: true,
      message: "delete image successfully",
      data: result,
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: "Failed to delete image",
    });
  }
};

// upload payment proof
const uploadPaymentProof = async (req, res, next) => {
  try {
    const { orderId, accountName, accountNumber, bankName, transferDate, amount } = req.body;

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Payment proof image is required",
      });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // specific validation: only for bank-transfer
    if (order.paymentMethod !== 'bank-transfer') {
      return res.status(400).json({
        success: false,
        message: "This order is not a bank transfer order",
      });
    }

    // Verify ownership or admin role
    const isOwner = order.user.toString() === req.user._id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to upload proof for this order",
      });
    }

    // Prevent status regression
    if (['paid', 'rejected', 'failed'].includes(order.paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot upload proof for order with status: ${order.paymentStatus}`,
      });
    }

    // Upload to Cloudinary
    const result = await cloudinaryServices.cloudinaryPaymentProofUpload(req.file.buffer);

    // Update order
    order.paymentProof = {
      imageUrl: result.secure_url,
      uploadedAt: new Date(),
    };

    // Update bank transfer details if provided
    if (accountName || accountNumber || bankName || transferDate || amount) {
      order.bankTransferDetails = {
        accountName,
        accountNumber,
        bankName,
        transferDate,
        amount
      };
    }

    order.paymentStatus = 'verifying';
    await order.save();

    res.status(200).json({
      success: true,
      message: "Payment proof uploaded successfully",
      data: order,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

exports.cloudinaryController = {
  cloudinaryDeleteController,
  saveImageCloudinary,
  addMultipleImageCloudinary,
  uploadPaymentProof,
};
