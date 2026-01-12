const dotenv = require("dotenv");
const cloudinaryModule = require("cloudinary");
const { secret } = require("../config/secret");

dotenv.config();
const cloudinary = cloudinaryModule.v2;

// Configure Cloudinary with API credentials
// Using individual config is more reliable than connection string for signed uploads
cloudinary.config({
  cloud_name: secret.cloudinary_name,
  api_key: secret.cloudinary_api_key,
  api_secret: secret.cloudinary_api_secret,
  secure: true
});

module.exports = cloudinary;