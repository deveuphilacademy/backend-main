const router = require('express').Router()
const {
  getAllCustomers,
  getCustomerById,
  updateCustomer
} = require('../controller/customer.controller')
const { isAuth } = require('../config/auth')

// GET /api/customer/all - Get all customers with order metrics
router.get('/all', isAuth, getAllCustomers)

// GET /api/customer/:id - Get single customer with order history
router.get('/:id', isAuth, getCustomerById)

// PATCH /api/customer/:id - Update customer profile
router.patch('/:id', isAuth, updateCustomer)

module.exports = router
