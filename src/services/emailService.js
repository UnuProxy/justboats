import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const sendBookingEmail = async (bookingData) => {
  try {
    console.log('Starting sendBookingEmail for:', bookingData.clientDetails.email);
    
    // Create email data object
    const emailData = {
      to: bookingData.clientDetails.email,
      template: 'booking-confirmation',
      data: {
        clientName: bookingData.clientDetails.name,
        bookingDate: bookingData.bookingDetails.date,
        bookingTime: `${bookingData.bookingDetails.startTime} - ${bookingData.bookingDetails.endTime}`,
        boatName: bookingData.bookingDetails.boatName,
        passengers: bookingData.bookingDetails.passengers,
        finalPrice: bookingData.pricing.finalPrice,
        deposit: bookingData.pricing.deposit,
        remainingPayment: bookingData.pricing.remainingPayment,
        transferRequired: bookingData.transfer.required,
        pickupDetails: bookingData.transfer.required ? {
          location: bookingData.transfer.pickup.location,
          address: bookingData.transfer.pickup.address
        } : null,
        restaurantName: bookingData.restaurantName || null,
        createdAt: new Date().toISOString()
      }
    };

    console.log('Prepared email data:', emailData);

    // Add to mail queue collection in Firestore
    const docRef = await addDoc(collection(db, 'mail'), emailData);
    console.log('Successfully added email to queue with ID:', docRef.id);

    return { success: true, emailId: docRef.id };
  } catch (error) {
    console.error('Error in sendBookingEmail:', {
      error: error.message,
      stack: error.stack,
      bookingEmail: bookingData.clientDetails.email
    });
    throw error;
  }
};

export const sendBookingUpdateEmail = async (bookingData, changes) => {
  try {
    console.log('Starting sendBookingUpdateEmail for:', bookingData.clientDetails.email);

    const emailData = {
      to: bookingData.clientDetails.email,
      template: 'booking-update',
      data: {
        clientName: bookingData.clientDetails.name,
        bookingDate: bookingData.bookingDetails.date,
        bookingTime: `${bookingData.bookingDetails.startTime} - ${bookingData.bookingDetails.endTime}`,
        boatName: bookingData.bookingDetails.boatName,
        changes: changes,
        updatedAt: new Date().toISOString()
      }
    };

    console.log('Prepared update email data:', emailData);

    const docRef = await addDoc(collection(db, 'mail'), emailData);
    console.log('Successfully added update email to queue with ID:', docRef.id);

    return { success: true, emailId: docRef.id };
  } catch (error) {
    console.error('Error in sendBookingUpdateEmail:', {
      error: error.message,
      stack: error.stack,
      bookingEmail: bookingData.clientDetails.email,
      changes: changes
    });
    throw error;
  }
};

export const sendCancellationEmail = async (bookingData) => {
  try {
    console.log('Starting sendCancellationEmail for:', bookingData.clientDetails.email);

    const emailData = {
      to: bookingData.clientDetails.email,
      template: 'booking-cancellation',
      data: {
        clientName: bookingData.clientDetails.name,
        bookingDate: bookingData.bookingDetails.date,
        boatName: bookingData.bookingDetails.boatName,
        cancellationDate: new Date().toISOString()
      }
    };

    console.log('Prepared cancellation email data:', emailData);

    const docRef = await addDoc(collection(db, 'mail'), emailData);
    console.log('Successfully added cancellation email to queue with ID:', docRef.id);

    return { success: true, emailId: docRef.id };
  } catch (error) {
    console.error('Error in sendCancellationEmail:', {
      error: error.message,
      stack: error.stack,
      bookingEmail: bookingData.clientDetails.email
    });
    throw error;
  }
};