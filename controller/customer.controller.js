const User = require('../model/User')
const Order = require('../model/Order')

// GET /api/customer/all - Get all customers with order aggregation
exports.getAllCustomers = async (req, res) => {
  try {
    // Get all users with role="user" (customers only, not admins)
    const customers = await User.find({ role: 'user' })
      .select('-password -confirmationToken -passwordResetToken -confirmationTokenExpires -passwordResetExpires')
      .lean()

    // For each customer, aggregate order data
    const customersWithOrders = await Promise.all(
      customers.map(async (customer) => {
        const orders = await Order.find({ user: customer._id })

        return {
          ...customer,
          totalOrders: orders.length,
          lifetimeValue: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
          lastOrderDate: orders.length > 0
            ? orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
            : null
        }
      })
    )

    res.status(200).send({
      success: true,
      result: customersWithOrders
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    res.status(500).send({
      success: false,
      message: error.message || 'Failed to fetch customers'
    })
  }
}

// GET /api/customer/:id - Get single customer with full order history
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id)
      .select('-password -confirmationToken -passwordResetToken -confirmationTokenExpires -passwordResetExpires')

    if (!customer) {
      return res.status(404).send({
        success: false,
        message: 'Customer not found'
      })
    }

    if (customer.role !== 'user') {
      return res.status(404).send({
        success: false,
        message: 'This user is not a customer'
      })
    }

    // Get customer orders sorted by creation date (newest first)
    const orders = await Order.find({ user: customer._id })
      .sort({ createdAt: -1 })
      .lean()

    res.status(200).send({
      success: true,
      result: {
        customer,
        orders,
        totalOrders: orders.length,
        lifetimeValue: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
      }
    })
  } catch (error) {
    console.error('Error fetching customer:', error)
    res.status(500).send({
      success: false,
      message: error.message || 'Failed to fetch customer details'
    })
  }
}

// PATCH /api/customer/:id - Update customer profile
exports.updateCustomer = async (req, res) => {
  try {
    const { name, email, phone, contactNumber, address, shippingAddress, status, bio } = req.body

    // Build update object with only provided fields
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber
    if (address !== undefined) updateData.address = address
    if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress
    if (status !== undefined) updateData.status = status
    if (bio !== undefined) updateData.bio = bio

    const customer = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -confirmationToken -passwordResetToken')

    if (!customer) {
      return res.status(404).send({
        success: false,
        message: 'Customer not found'
      })
    }

    if (customer.role !== 'user') {
      return res.status(400).send({
        success: false,
        message: 'Cannot update non-customer users via this endpoint'
      })
    }

    res.status(200).send({
      success: true,
      result: customer,
      message: 'Customer updated successfully'
    })
  } catch (error) {
    console.error('Error updating customer:', error)

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).send({
        success: false,
        message: Object.values(error.errors).map(e => e.message).join(', ')
      })
    }

    res.status(500).send({
      success: false,
      message: error.message || 'Failed to update customer'
    })
  }
}
