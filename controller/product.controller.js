const productServices = require("../services/product.service");
const inventoryService = require("../services/inventory.service");
const Product = require("../model/Products");


// add product
exports.addProduct = async (req, res, next) => {
  console.log('product--->', req.body);
  try {
    const firstItem = {
      color: {
        name: '',
        clrCode: ''
      },
      img: req.body.img,
    };
    const imageURLs = [firstItem, ...req.body.imageURLs];
    const result = await productServices.createProductService({
      ...req.body,
      imageURLs: imageURLs,
    });

    console.log('product-result', result)

    res.status(200).json({
      success: true,
      status: "success",
      message: "Product created successfully!",
      data: result,
    });
  } catch (error) {
    console.log(error);
    next(error)
  }
};


// add all product
module.exports.addAllProducts = async (req, res, next) => {
  try {
    const result = await productServices.addAllProductService(req.body);
    res.json({
      message: 'Products added successfully',
      result,
    })
  } catch (error) {
    next(error)
  }
}

// get all products
exports.getAllProducts = async (req, res, next) => {
  try {
    const result = await productServices.getAllProductsService();
    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// get all products by type
module.exports.getProductsByType = async (req, res, next) => {
  try {
    const result = await productServices.getProductTypeService(req);
    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.log(error)
    next(error)
  }
}

// get offer product controller
module.exports.getOfferTimerProducts = async (req, res, next) => {
  try {
    const result = await productServices.getOfferTimerProductService(req.query.type);
    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// get Popular Product By Type
module.exports.getPopularProductByType = async (req, res, next) => {
  try {
    const result = await productServices.getPopularProductServiceByType(req.params.type);
    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// get top rated Products
module.exports.getTopRatedProducts = async (req, res, next) => {
  try {
    const result = await productServices.getTopRatedProductService();
    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// getSingleProduct
exports.getSingleProduct = async (req, res, next) => {
  try {
    const product = await productServices.getProductService(req.params.id)
    res.json(product)
  } catch (error) {
    next(error)
  }
}

// get Related Product
exports.getRelatedProducts = async (req, res, next) => {
  try {
    const products = await productServices.getRelatedProductService(req.params.id)
    res.status(200).json({
      success: true,
      data: products,
    })
  } catch (error) {
    next(error)
  }
}

// update product
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await productServices.updateProductService(req.params.id, req.body)
    res.send({ data: product, message: "Product updated successfully!" });
  } catch (error) {
    next(error)
  }
};

// update product
exports.reviewProducts = async (req, res, next) => {
  try {
    const products = await productServices.getReviewsProducts()
    res.status(200).json({
      success: true,
      data: products,
    })
  } catch (error) {
    next(error)
  }
};

// update product
exports.stockOutProducts = async (req, res, next) => {
  try {
    const products = await productServices.getStockOutProducts();
    res.status(200).json({
      success: true,
      data: products,
    })
  } catch (error) {
    next(error)
  }
};

// delete product
exports.deleteProduct = async (req, res, next) => {
  try {
    await productServices.deleteProduct(req.params.id);
    res.status(200).json({
      message: "Product delete successfully",
    });
  } catch (error) {
    next(error);
  }
};

// adjust stock
exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, action, note } = req.body;
    const productId = req.params.id;
    const adminId = req.user._id;

    const updatedProduct = await inventoryService.adjustStock(
      productId,
      quantity,
      action,
      adminId,
      note
    );

    res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// get stock history
exports.getStockHistory = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await inventoryService.getStockHistory(productId);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// get low stock products
exports.getLowStockProducts = async (req, res, next) => {
  try {
    const products = await inventoryService.checkLowStock();
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// notify when available
exports.notifyWhenAvailable = async (req, res, next) => {
  try {
    const { email } = req.body;
    const productId = req.params.id;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.status !== "out-of-stock") {
      return res.status(400).json({
        success: false,
        message: "Product is currently in stock",
      });
    }

    // Check if email already in list
    const isAlreadyNotified = product.notifyList.some(item => item.email === email);
    if (isAlreadyNotified) {
      return res.status(200).json({
        success: true,
        message: "You are already on the notification list for this product",
      });
    }

    product.notifyList.push({ email });
    await product.save();

    res.status(200).json({
      success: true,
      message: "We'll email you when this product is back in stock!",
    });
  } catch (error) {
    next(error);
  }
};

