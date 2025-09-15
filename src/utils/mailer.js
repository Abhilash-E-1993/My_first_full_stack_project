const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOtpEmail = async (toEmail, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: 'Your Bank Verification Code',
        text: `Your OTP for account verification is: ${otp}. It is valid for 5 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP email sent to ${toEmail}`);
    } catch (error) {
        console.error(`Error sending OTP email: ${error}`);
    }
};
// ... keep sendOtpEmail function ...

const sendLoanStatusEmail = async (toEmail, loanType, amount, status) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: `Update on Your ${loanType} Loan Application`,
        text: `Dear Customer,\n\nThis is to inform you that your loan application for a ${loanType} loan of $${amount} has been ${status.toUpperCase()}.\n\nThank you for banking with us.\n\nSincerely,\nGemini Bank`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Loan status email sent to ${toEmail}`);
    } catch (error) {
        console.error(`Error sending loan status email: ${error}`);
    }
};

module.exports = { sendOtpEmail, sendLoanStatusEmail }; // Add the new function here

