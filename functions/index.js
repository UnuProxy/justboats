const functions = require("firebase-functions/v2");
const sgMail = require("@sendgrid/mail");
const admin = require("firebase-admin");

admin.initializeApp();

// Initialise SendGrid
const sendgridApiKey = functions.config().sendgrid.key;


if (!sendgridApiKey) {
  throw new Error("SendGrid API key is missing. Please set it in your environment variables.");
}

sgMail.setApiKey(sendgridApiKey);

exports.sendEmail = functions.firestore
  .document("mail/{emailId}")
  .onCreate(async (snap, context) => {
    const emailData = snap.data();

    if (!emailData.to || !emailData.message || !emailData.message.subject || !emailData.message.text) {
      console.error("Invalid email data. Missing required fields.");
      await snap.ref.update({
        status: "error",
        error: "Missing required fields in email data.",
        errorTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      return null;
    }

    try {
      const msg = {
        to: emailData.to,
        from: "info@justenjoyibiza.com",
        subject: emailData.message.subject,
        text: emailData.message.text,
      };

      console.log(`Sending email to ${emailData.to} with subject: "${emailData.message.subject}"`);

      await sgMail.send(msg);

      await snap.ref.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Email sent successfully to ${emailData.to}`);
      return null;
    } catch (error) {
      console.error("Error sending email:", error);

      await snap.ref.update({
        status: "error",
        error: error.message,
        errorTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      throw error; // Re-throw the error to notify Firebase of the failure.
    }
  });
