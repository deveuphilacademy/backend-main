require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { secret } = require('./secret');

// sendEmail
module.exports.sendEmail = (body, res, message) => {
  const transporter = nodemailer.createTransport({
    host: secret.email_host,
    service: secret.email_service, //comment this line if you use custom server/domain
    port: secret.email_port,
    secure: true,
    auth: {
      user: secret.email_user,
      pass: secret.email_pass,
    },
  });

  transporter.verify(function (err, success) {
    if (err) {
      res.status(403).send({
        message: `Error happen when verify ${err.message}`,
      });
      console.log(err.message);
    } else {
      console.log('Server is ready to take our messages');
    }
  });

  transporter.sendMail(body, (err, data) => {
    if (err) {
      res.status(403).send({
        message: `Error happen when sending email ${err.message}`,
      });
    } else {
      res.send({
        message: message,
      });
    }
  });
};

// sendEmailStandalone
module.exports.sendEmailStandalone = (body) => {
  return new Promise((resolve, reject) => {
    const transporter = nodemailer.createTransport({
      host: secret.email_host,
      service: secret.email_service,
      port: secret.email_port,
      secure: true,
      auth: {
        user: secret.email_user,
        pass: secret.email_pass,
      },
    });

    transporter.sendMail(body, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

// renderTemplate
module.exports.renderTemplate = (templateName, variables) => {
  const templatePath = path.join(__dirname, '..', 'views', 'emails', `${templateName}.html`);
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    return '';
  }

  let template = fs.readFileSync(templatePath, 'utf8');

  Object.keys(variables).forEach((key) => {
    const placeholder = `{{${key}}}`;
    // Global replacement for all occurrences
    template = template.split(placeholder).join(variables[key] || '');
  });

  return template;
};
