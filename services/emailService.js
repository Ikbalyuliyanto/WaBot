const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'dev.stack404@gmail.com',
    pass: 'vawj zybj kipn pcde', // app password, bukan password asli
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
