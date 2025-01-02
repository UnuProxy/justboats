// src/utils/userManagement.js
import { db } from '../firebase/firebaseConfig';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Fetch admin emails from environment variables
const adminEmails = process.env.REACT_APP_ADMIN_EMAILS
  ? process.env.REACT_APP_ADMIN_EMAILS.split(',').map(email => email.trim())
  : ['julian.pirvu@gmail.com']; // Ensure your admin emails are listed here

/**
 * Adds or updates a user in the 'approvedUsers' collection.
 * @param {Object} userData - The user data.
 * @returns {Object} - Result of the operation.
 */
export const addApprovedUser = async (userData) => {
  try {
    if (!userData.email || !userData.email.endsWith('@gmail.com')) {
      throw new Error('Only Gmail addresses are allowed');
    }

    // Assign role based on email
    const role = adminEmails.includes(userData.email) ? 'admin' : 'user';

    // Use email as document ID in 'approvedUsers'
    const approvedUserRef = doc(db, 'approvedUsers', userData.email);

    // Check if user is already approved
    const q = query(collection(db, 'approvedUsers'), where('email', '==', userData.email));
    const approvedUserSnapshot = await getDocs(q);
    if (!approvedUserSnapshot.empty) {
      throw new Error('User is already approved');
    }

    // Add user to 'approvedUsers'
    await setDoc(approvedUserRef, {
      email: userData.email,
      name: userData.name,
      role: role,
      createdAt: new Date()
    }, { merge: true });

    return { 
      success: true,
      message: role === 'admin' ? 
        'Admin user added successfully.' :
        'User added successfully.'
    };
  } catch (error) {
    console.error('Error adding approved user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Removes a user from the 'approvedUsers' collection.
 * @param {string} email - The email of the user to remove.
 * @returns {Object} - Result of the operation.
 */
export const removeApprovedUser = async (email) => {
  try {
    const approvedUserRef = doc(db, 'approvedUsers', email);
    await deleteDoc(approvedUserRef);
    return { success: true };
  } catch (error) {
    console.error('Error removing approved user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Removes a user from the 'users' collection.
 * @param {string} uid - The UID of the user to remove.
 * @returns {Object} - Result of the operation.
 */
export const removeUser = async (uid) => {
  try {
    await deleteDoc(doc(db, 'users', uid));
    return { success: true };
  } catch (error) {
    console.error('Error removing user:', error);
    return { success: false, error: error.message };
  }
};
