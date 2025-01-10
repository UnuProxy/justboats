const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

if (!admin.apps.length) {
    admin.initializeApp();
}

const sgMail = require('@sendgrid/mail');
const sendGridApiKey = functions.config()?.sendgrid?.api_key;
if (!sendGridApiKey) {
    throw new Error('SendGrid API key is missing');
}

sgMail.setApiKey(sendGridApiKey);
const SENDGRID_TEMPLATE_ID = 'd-a0536d03f0c74ef2b52e722e8b26ef4e';

exports.processNewBookingEmailV2 = onDocumentCreated('bookings/{bookingId}', async (event) => {
    try {
        const booking = event.data.data();
        if (!booking) {
            console.error('No booking data found');
            return null;
        }

        // Prepare template data
        const templateData = {
            clientName: booking.clientDetails?.name || 'Guest',
            bookingDate: booking.bookingDetails?.date || 'N/A',
            startTime: booking.bookingDetails?.startTime || 'N/A',
            endTime: booking.bookingDetails?.endTime || 'N/A',
            boatName: booking.bookingDetails?.boatName || 'N/A',
            passengers: booking.bookingDetails?.passengers || 'N/A',
            totalAmount: booking.pricing?.finalPrice || 0,
            depositRequired: booking.pricing?.deposit || 0,
        };

        console.log('Email template data:', templateData);

        const emailData = {
            to: booking.clientDetails?.email,
            from: 'info@justenjoyibiza.com',
            templateId: SENDGRID_TEMPLATE_ID,
            dynamic_template_data: templateData
        };

        console.log('SendGrid message data:', emailData);

        try {
            await sgMail.send(emailData);
            console.log('Email sent successfully to:', booking.clientDetails?.email);

            await event.data.ref.update({
                emailSent: true,
                emailSentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

        } catch (sgError) {
            console.error('SendGrid Error:', sgError);
            if (sgError.response) {
                console.error('SendGrid Error Body:', sgError.response.body);
            }
            throw sgError;
        }

        return null;
    } catch (error) {
        console.error('Error processing email:', error);
        throw error;
    }
});












  
  

