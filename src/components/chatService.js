import { db } from '../firebase/firebaseConfig.js';
import {
    collection,
    onSnapshot,
    addDoc,
    getDocs,
    doc,
    setDoc,
    query,
    orderBy,
    serverTimestamp,
    where
} from 'firebase/firestore';

export const chatService = {
    // Subscribe to all conversations
    subscribeToConversations(callback) {
        const conversationsRef = collection(db, 'chatConversations');
        // Only get active or agent-handling conversations
        const q = query(
            conversationsRef,
            where('status', 'in', ['active', 'agent-handling']),
            orderBy('lastUpdated', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const conversations = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Convert timestamps to dates if they exist
                    lastMessageAt: data.lastMessageAt?.toDate?.() || data.lastMessageAt,
                    lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated,
                    takenOverAt: data.takenOverAt?.toDate?.() || data.takenOverAt,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt
                };
            }).filter(conv => conv.lastUpdated); // Only include conversations with timestamps

            callback(conversations);
        }, error => {
            console.error("Error fetching conversations:", error);
            callback([]);
        });
    },

    // Subscribe to messages for a conversation
    subscribeToMessages(conversationId, callback) {
        const messagesRef = collection(db, 'chatConversations', conversationId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate?.() || data.timestamp
                };
            });

            // Sort messages by timestamp, handling both Date objects and Firestore timestamps
            const sortedMessages = messages.sort((a, b) => {
                const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
                const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
                return timeA - timeB;
            });

            callback(sortedMessages);
        }, error => {
            console.error("Error fetching messages:", error);
            callback([]);
        });
    },

    // Send a message
    async sendMessage(conversationId, content, role) {
        try {
            const convRef = doc(db, 'chatConversations', conversationId);
            const timestamp = serverTimestamp();

            // First update conversation metadata
            await setDoc(convRef, {
                lastMessage: content,
                lastMessageAt: timestamp,
                lastUpdated: timestamp,
                lastMessageRole: role,
                status: role === 'agent' ? 'agent-handling' : 'active'
            }, { merge: true });

            // Then add the message
            await addDoc(collection(convRef, 'messages'), {
                content,
                role,
                timestamp
            });

            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    },

    // Take over conversation
    async takeOverConversation(conversationId, agentId) {
        try {
            const convRef = doc(db, 'chatConversations', conversationId);
            const timestamp = serverTimestamp();

            // Update conversation status first
            await setDoc(convRef, {
                status: 'agent-handling',
                agentId,
                takenOverAt: timestamp,
                lastUpdated: timestamp,
                botEnabled: false
            }, { merge: true });

            // Then add the system message
            const systemMessage = `Conversation taken over by agent ${agentId}`;
            await addDoc(collection(convRef, 'messages'), {
                content: systemMessage,
                role: 'system',
                timestamp
            });

            // Update conversation metadata for the system message
            await setDoc(convRef, {
                lastMessage: systemMessage,
                lastMessageAt: timestamp,
                lastMessageRole: 'system'
            }, { merge: true });

            return true;
        } catch (error) {
            console.error('Error taking over conversation:', error);
            return false;
        }
    }
};