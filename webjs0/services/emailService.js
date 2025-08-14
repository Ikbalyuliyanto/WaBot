const nodemailer = require('nodemailer');
const config = require('../config/config.json');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.useremail,
    pass: config.passwordemail,
  },
});

async function kirimEmailWithAttachment({ to, subject, text, attachments }) {
  const mailOptions = {
    from: 'emailkamu@gmail.com',
    to,
    subject,
    text,
    attachments,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = {
  kirimEmailWithAttachment
};
