const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const sgMail = require('@sendgrid/mail');
const functions = require('firebase-functions');

// Load SendGrid API Key from Firebase Config
sgMail.setApiKey(functions.config().sendgrid.api_key);

// Cloud Function to Send Email
exports.sendEmail = onDocumentCreated('mail/{emailId}', async (event) => {
  const snapshot = event.data;
  const emailData = snapshot.data();

  const msg = {
    to: emailData.to, // Recipient's email from Firestore
    from: 'info@justenjoyibiza.com', // Your verified SendGrid sender email
    subject: emailData.subject || 'Booking Confirmation',
    text: emailData.text || 'Thank you for your booking!',
    html: emailData.html || '<strong>Thank you for booking with Just Boats Ibiza!</strong>',
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent to:', emailData.to);

    // Update Firestore document to indicate success
    await snapshot.ref.update({
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error sending email:', error);

    // Update Firestore document with error status
    await snapshot.ref.update({
      status: 'error',
      error: error.message,
    });
  }
});



