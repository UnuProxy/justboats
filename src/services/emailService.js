// src/services/emailService.js
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const sendBookingEmail = async (bookingData) => {
  try {
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

    // Add to mail queue collection in Firestore
    await addDoc(collection(db, 'mail'), emailData);

    return { success: true };
  } catch (error) {
    console.error('Error queueing email:', error);
    throw error;
  }
};

export const sendBookingUpdateEmail = async (bookingData, changes) => {
  try {
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

    await addDoc(collection(db, 'mail'), emailData);
    return { success: true };
  } catch (error) {
    console.error('Error queueing update email:', error);
    throw error;
  }
};

export const sendCancellationEmail = async (bookingData) => {
  try {
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

    await addDoc(collection(db, 'mail'), emailData);
    return { success: true };
  } catch (error) {
    console.error('Error queueing cancellation email:', error);
    throw error;
  }
};