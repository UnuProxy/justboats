import React, { useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase/firebaseConfig';

const FirestoreTest = () => {
  useEffect(() => {
    const testFirestoreConnection = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'testCollection'));
        console.log('Documents:', snapshot.docs.map((doc) => doc.data()));
      } catch (error) {
        console.error('Firestore connection error:', error);
      }
    };

    testFirestoreConnection();
  }, []);

  return <div>Testing Firestore Connection...</div>;
};

export default FirestoreTest;


