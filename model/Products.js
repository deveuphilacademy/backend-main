const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
// schema design
const validator = require("validator");

const productsSchema = mongoose.Schema({
  sku: {
    type: String,
    required: false,
  },
  img:{
    type: String,
    required: true,
    validate: [validator.isURL, "Please provide valid url(s)"]
  },
  title: {
    type: String,
    required: [true, "Please provide a name for this product."],
    trim: true,
    minLength: [3, "Name must be at least 3 characters."],
    maxLength: [200, "Name is too large"],
  },
  slug: {
    type: String,
    trim: true,
    required: false,
  },
  unit: {
    type: String,
    required: true,
  },
  imageURLs: [{
    color:{
      name:{
        type: String,
        required: false,
        trim: true,
      },
      clrCode:{
        type: String,
        required: false,
        trim: true,
      }
    },
    img:{
      type: String,
      required: false,
      validate: [validator.isURL, "Please provide valid url(s)"]
    },
    sizes:[String]
  }],
  parent:{
    type:String,
    required:true,
    trim:true,
   },
  children:{
    type:String,
    required:true,
    trim:true,
  },
  price: {
    type: Number,
    required: true,
    min: [0, "Product price can't be negative"]
  },
  discount: {
    type: Number,
    min: [0, "Product price can't be negative"]
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, "Product quantity can't be negative"]
  },
  brand: {
    name: {
      type: String,
      required: true,
    },
    id: {
      type: ObjectId,
      ref: "Brand",
      required: true,
    }
  },
  category: {
    name: {
      type: String,
      required: true,
    },
    id: {
      type: ObjectId,
      ref: "Category",
      required: true,
    }
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ["in-stock", "out-of-stock", "discontinued"],
      message: "status can't be {VALUE} "
    },
    default: "in-stock",
  },
  reviews: [{type:ObjectId, ref: 'Reviews' }],
  productType:{
    type:String,
    required: true,
    lowercase: true,
  },
  description: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    required: false
  },
  additionalInformation: [{}],
  tags: [String],
  sizes: [String],
  offerDate:{
    startDate:{
      type:Date
    },
    endDate:{
      type:Date
    },
  },
  featured: {
    type: Boolean,
    default: false,
  },
  sellCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    required: false,
    default: 10,
    min: [0, "Low stock threshold can't be negative"]
  },
  reorderPoint: {
    type: Number,
    required: false,
    default: 5,
    min: [0, "Reorder point can't be negative"]
  },
  reorderQuantity: {
    type: Number,
    required: false,
    min: [0, "Reorder quantity can't be negative"]
  },
  lastRestocked: {
    type: Date,
    required: false
  },
  stockHistory: [{
    quantity: {
      type: Number,
      required: true
    },
    action: {
      type: String,
      required: true,
      enum: ['sale', 'restock', 'adjustment', 'return', 'cancelled-order'],
      lowercase: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },
    note: {
      type: String,
      required: false,
      maxLength: [500, "Note is too long"]
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    }
  }]
}, {
  timestamps: true,
})

// Indexes for performance optimization
productsSchema.index({ quantity: 1, status: 1 }); // For low stock queries
productsSchema.index({ 'category.id': 1, status: 1 }); // For category-based inventory
productsSchema.index({ 'brand.id': 1, status: 1 }); // For brand-based inventory

const Products = mongoose.model('Products', productsSchema)

module.exports = Products;