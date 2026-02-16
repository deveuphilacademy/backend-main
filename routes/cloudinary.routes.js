const express = require('express');
const router = express.Router();
// internal
const uploader = require('../middleware/uploder');
const verifyToken = require('../middleware/verifyToken');
const { cloudinaryController } = require('../controller/cloudinary.controller');
const multer = require('multer');

const upload = multer();
//add image
router.post('/add-img', upload.single('image'), cloudinaryController.saveImageCloudinary);

//add image
router.post('/add-multiple-img', upload.array('images', 5), cloudinaryController.addMultipleImageCloudinary);

//delete image
router.delete('/img-delete', cloudinaryController.cloudinaryDeleteController);

// upload payment proof
router.post('/upload-payment-proof', verifyToken, upload.single('image'), cloudinaryController.uploadPaymentProof);

module.exports = router;