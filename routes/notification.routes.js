const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorization = require('../middleware/authorization');
const {
    getNotifications,
    markNotificationRead,
    getUnreadCount
} = require('../controller/notification.controller');

// All notification routes are protected and restricted to staff
router.get('/', verifyToken, authorization('Admin', 'Super Admin', 'Manager', 'CEO'), getNotifications);
router.post('/:id/read', verifyToken, authorization('Admin', 'Super Admin', 'Manager', 'CEO'), markNotificationRead);
router.get('/unread-count', verifyToken, authorization('Admin', 'Super Admin', 'Manager', 'CEO'), getUnreadCount);

module.exports = router;
