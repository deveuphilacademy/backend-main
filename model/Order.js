const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cart: [{}],
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    contact: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
    },
    shippingCost: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    shippingOption: {
      type: String,
      required: false,
    },
    cardInfo: {
      type: Object,
      required: false,
    },
    paymentIntent: {
      type: Object,
      required: false,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['paystack', 'flutterwave', 'bank-transfer', 'COD', 'cash-on-delivery', 'card'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'verifying', 'rejected'],
      default: 'pending',
      lowercase: true
    },
    paymentReference: {
      type: String,
      required: false,
      unique: true,
      sparse: true // Allows multiple null values
    },
    paymentVerifiedAt: {
      type: Date,
      required: false
    },
    paymentProof: {
      imageUrl: {
        type: String,
        required: false
      },
      uploadedAt: {
        type: Date,
        required: false
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false
      },
      verifiedAt: {
        type: Date,
        required: false
      },
      rejectionReason: {
        type: String,
        required: false,
        maxLength: [500, "Rejection reason is too long"]
      }
    },
    bankTransferDetails: {
      accountName: {
        type: String,
        required: false
      },
      accountNumber: {
        type: String,
        required: false
      },
      bankName: {
        type: String,
        required: false
      },
      transferDate: {
        type: Date,
        required: false
      },
      amount: {
        type: Number,
        required: false,
        min: [0, "Amount can't be negative"]
      }
    },
    orderNote: {
      type: String,
      required: false,
    },
    invoice: {
      type: Number,
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "delivered", 'cancel'],
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance optimization
orderSchema.index({ paymentStatus: 1, createdAt: -1 }); // For pending payment queries
orderSchema.index({ paymentReference: 1 }); // For payment verification lookups
orderSchema.index({ user: 1, status: 1 }); // For user order history
orderSchema.index({ status: 1, createdAt: -1 }); // For admin order management

// define pre-save middleware to generate the invoice number
orderSchema.pre('save', async function (next) {
  const order = this;
  if (!order.invoice) { // check if the order already has an invoice number
    try {
      // find the highest invoice number in the orders collection
      const highestInvoice = await mongoose
        .model('Order')
        .find({})
        .sort({ invoice: 'desc' })
        .limit(1)
        .select({ invoice: 1 });
      // if there are no orders in the collection, start at 1000
      const startingInvoice = highestInvoice.length === 0 ? 1000 : highestInvoice[0].invoice + 1;
      // set the invoice number for the new order
      order.invoice = startingInvoice;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
module.exports = Order;
