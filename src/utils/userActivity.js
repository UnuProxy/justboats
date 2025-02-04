// utils/userActivity.js
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const updateUserLastLogin = async (uid) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    lastLogin: serverTimestamp()
  });
};
