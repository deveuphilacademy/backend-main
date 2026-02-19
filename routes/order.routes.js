const express = require("express");
const {
  addOrder,
  getOrders,
  updateOrderStatus,
  getSingleOrder,
} = require("../controller/order.controller");

// router
const router = express.Router();

// get orders
router.get("/orders", getOrders);
// single order
router.get("/:id", getSingleOrder);
// save Order
router.post("/saveOrder", addOrder);
// update status
router.patch("/update-status/:id", updateOrderStatus);

module.exports = router;
