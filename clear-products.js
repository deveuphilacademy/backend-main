require('dotenv').config();

const mongoose = require('mongoose');
const Products = require('./model/Products');
const Order = require('./model/Order');
const Review = require('./model/Review');

const clearProducts = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
    console.log('✓ Connected to MongoDB');

    console.log('\nClearing old cosmetics/electronics products...');

    // Delete all products
    const productsResult = await Products.deleteMany();
    console.log(`✓ Deleted ${productsResult.deletedCount} products`);

    // Delete all orders (they reference products)
    const ordersResult = await Order.deleteMany();
    console.log(`✓ Deleted ${ordersResult.deletedCount} orders`);

    // Delete all reviews (they reference products)
    const reviewsResult = await Review.deleteMany();
    console.log(`✓ Deleted ${reviewsResult.deletedCount} reviews`);

    console.log('\n✅ Database cleaned successfully!');
    console.log('You can now add Nigerian food products through the admin dashboard.');
    console.log('\nCategories and brands are still intact:');
    console.log('- 15 Nigerian food categories');
    console.log('- 6 Nigerian food brands');

    await mongoose.connection.close();
    process.exit();
  } catch (error) {
    console.log('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

clearProducts();
