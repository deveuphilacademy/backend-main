const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env') })

module.exports.secret = {
  port: process.env.PORT,
  env: process.env.NODE_ENV,
  db_url: process.env.MONGO_URI,
  token_secret: process.env.TOKEN_SECRET,
  jwt_secret_for_verify: process.env.JWT_SECRET_FOR_VERIFY,

  email_service: process.env.SERVICE,
  email_user: process.env.EMAIL_USER,
  email_pass: process.env.EMAIL_PASS,
  email_host: process.env.HOST,
  email_port: process.env.EMAIL_PORT,

  cloudinary_url: process.env.CLOUDINARY_URL,
  cloudinary_name: process.env.CLOUDINARY_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  cloudinary_upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,

  stripe_key: process.env.STRIPE_KEY,
  client_url: process.env.STORE_URL,
  admin_url: process.env.ADMIN_URL,

  // Payment Gateway Configuration
  paystack_public_key: process.env.PAYSTACK_PUBLIC_KEY,
  paystack_secret_key: process.env.PAYSTACK_SECRET_KEY,

  flw_public_key: process.env.FLW_PUBLIC_KEY,
  flw_secret_key: process.env.FLW_SECRET_KEY,
  flw_encryption_key: process.env.FLW_ENCRYPTION_KEY,

  // Bank Account Details
  bank_name: process.env.BANK_NAME,
  account_name: process.env.ACCOUNT_NAME,
  account_number: process.env.ACCOUNT_NUMBER,

  // Webhook Secrets
  flw_webhook_hash: process.env.FLW_WEBHOOK_HASH,
}
