// src/services/emailService.js

export const sendBookingEmail = async (bookingData) => {
  const { clientDetails, bookingDetails, transfer, pricing, notes } = bookingData;

  const startTime = new Date(`2000-01-01T${bookingDetails.startTime}`);
  const endTime = new Date(`2000-01-01T${bookingDetails.endTime}`);
  const durationHours = (endTime - startTime) / (1000 * 60 * 60);

  const meetingPoint = transfer.required ? 
    `Pickup from ${transfer.pickup.location} - ${transfer.pickup.address}` :
    'Marina (details to be provided)';

  const bookingDate = new Date(bookingDetails.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const emailContent = `Dear ${clientDetails.name},

Thank you for booking with Just Enjoy Ibiza Boats!

Booking Details:
- Date: ${bookingDate}
- Time: ${bookingDetails.startTime} - ${bookingDetails.endTime}
- Boat: ${bookingDetails.boatName}
- Duration: ${durationHours} hours
- Meeting Point: ${meetingPoint}

Pricing Information:
- Total Price: €${pricing.finalPrice}
- Deposit Required: €${pricing.deposit}
- Remaining Balance: €${pricing.remainingPayment}

What to Bring:
- Swimwear and towels
- Sunscreen
- Valid ID (${clientDetails.passportNumber ? 'Passport number: ' + clientDetails.passportNumber : 'Please bring your passport'})
- Booking confirmation

${transfer.required ? `Transfer Details:
- Pickup: ${transfer.pickup.location} - ${transfer.pickup.address}
- Drop-off: ${transfer.dropoff.location} - ${transfer.dropoff.address}
` : ''}
${notes ? `Additional Notes:
${notes}

` : ''}Cancellation Policy:
- Free cancellation up to 48 hours before
- 50% charge for cancellations within 48 hours
- No refund for no-shows

Need to modify your booking? Contact us at bookings@justenjoyibiza.com

See you soon!
Just Boats Ibiza Team`;

  try {
    const response = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: clientDetails.email,
        subject: `Booking Confirmation - ${bookingDetails.boatName} - ${bookingDate}`,
        text: emailContent,
        html: emailContent.replace(/\n/g, '<br>')
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};