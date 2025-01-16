// chatService.js
import { db } from '../firebase/firebaseConfig.js';
import { collection, onSnapshot, addDoc, getDocs, doc } from 'firebase/firestore';

export const chatService = {
  // Subscribe to conversations
  subscribeToConversations(callback) {
    console.log('Starting subscription to conversations...');
    
    const conversationId = 'conv_1736951972092_40159';
    const convRef = doc(db, 'chatConversations', conversationId);
    const messagesRef = collection(convRef, 'messages');
    
    // Listen to messages subcollection directly
    return onSnapshot(messagesRef, {
      next: async (messagesSnapshot) => {
        try {
          const messages = [];
          messagesSnapshot.forEach((messageDoc) => {
            messages.push({
              id: messageDoc.id,
              ...messageDoc.data()
            });
          });

          // Create conversation object with messages
          const conversation = {
            id: conversationId,
            messages: messages.sort((a, b) => 
              new Date(a.timestamp) - new Date(b.timestamp)
            )
          };

          console.log('Processed conversation:', conversation);
          callback([conversation]);
        } catch (error) {
          console.error('Error processing messages:', error);
          callback([]);
        }
      },
      error: (error) => {
        console.error('Subscription error:', error);
        callback([]);
      }
    });
  },

  // Get messages for a specific conversation
  async getMessages(conversationId) {
    console.log('Getting messages for conversation:', conversationId);
    try {
      const convRef = doc(db, 'chatConversations', conversationId);
      const messagesRef = collection(convRef, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      
      const messages = [];
      messagesSnap.forEach(doc => {
        messages.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('Retrieved messages:', messages);
      return messages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  },

  // Send a new message
  async sendMessage(conversationId, content, role) {
    try {
      const convRef = doc(db, 'chatConversations', conversationId);
      const messagesRef = collection(convRef, 'messages');
      const messageData = {
        content,
        role,
        timestamp: new Date().toISOString()
      };
      
      await addDoc(messagesRef, messageData);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
};