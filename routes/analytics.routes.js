const express = require("express");
const router = express.Router();
const analyticsController = require("../controller/analytics.controller");
const verifyToken = require("../middleware/verifyToken");
const authorization = require("../middleware/authorization");

router.get("/dashboard", verifyToken, authorization("admin"), analyticsController.getDashboardAnalytics);

module.exports = router;
