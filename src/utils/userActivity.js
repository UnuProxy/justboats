// utils/userActivity.js
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const updateUserLastLogin = async (uid) => {
  try {
    if (!uid) {
      throw new Error('User ID is required to update last login');
    }

    const userRef = doc(db, 'users', uid);
    
    // Use setDoc with merge: true to ensure document exists
    await setDoc(userRef, {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log('Successfully updated last login for user:', uid);
    return true;
  } catch (error) {
    console.error('Error updating user last login:', error);
    throw new Error(`Failed to update last login: ${error.message}`);
  }
};