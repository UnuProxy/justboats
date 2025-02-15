import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const createNotification = async ({ type, title, message, link = null }) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      type,
      title,
      message,
      link,
      timestamp: serverTimestamp(),
      read: false
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const createBookingNotification = async (clientName, boatName, date, bookingId) => {
  await createNotification({
    type: 'booking',
    title: 'New Booking Created',
    message: `${clientName} booked ${boatName} for ${date}`,
    link: `/bookings/${bookingId}`, // Using path parameter instead of query
    bookingId
  });
};

export const createPaymentNotification = async (amount, clientName, bookingId) => {
  await createNotification({
    type: 'payment',
    title: 'Payment Received',
    message: `€${amount} received from ${clientName}`,
    link: `/payment-tracking?booking=${bookingId}`
  });
};

export const createClientUpdateNotification = async (clientName, action) => {
  await createNotification({
    type: 'client',
    title: 'Client Profile Updated',
    message: `Client ${clientName} has been ${action}`,
    link: '/clients'
  });
};

export const createTransferNotification = async (bookingId, clientName, pickupTime) => {
  await createNotification({
    type: 'transfer',
    title: 'Transfer Required',
    message: `Transfer needed for ${clientName}'s booking at ${pickupTime}`,
    link: `/bookings?id=${bookingId}&tab=transfer`
  });
};

export const createClientBirthdayNotification = async (clientName, birthDate) => {
  await createNotification({
    type: 'birthday',
    title: 'Client Birthday',
    message: `${clientName}'s birthday is coming up on ${birthDate}`,
    link: '/clients'
  });
};

export const createSystemNotification = async (title, message, link = null) => {
  await createNotification({
    type: 'system',
    title,
    message,
    link
  });
};

export const createPaymentDueNotification = async (clientName, amount, dueDate, bookingId) => {
  await createNotification({
    type: 'payment',
    title: 'Payment Due',
    message: `Payment of €${amount} from ${clientName} is due on ${dueDate}`,
    link: `/payment-tracking?booking=${bookingId}`
  });
};