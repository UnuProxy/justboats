import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, User } from 'lucide-react';
import { db } from '../firebase/firebaseConfig.js';
import { collection, onSnapshot, doc, addDoc, setDoc, serverTimestamp,query, orderBy } from 'firebase/firestore';

const formatFirebaseTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    // Handle Firestore timestamp
    if (timestamp?.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    // Handle ISO string
    if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleString();
    }
    // Handle Date object
    if (timestamp instanceof Date) {
        return timestamp.toLocaleString();
    }
    return '';
};

const ChatbotSettings = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [agentMessage, setAgentMessage] = useState('');
    const [isTakenOver, setIsTakenOver] = useState(false);

    // Subscribe to all conversations
    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'chatConversations'),
            (snapshot) => {
                const convs = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    convs.push({
                        id: doc.id,
                        ...data,
                        lastMessageAt: data.lastMessageAt ? formatFirebaseTimestamp(data.lastMessageAt) : ''
                    });
                });
                setConversations(convs);
            }
        );
        return () => unsubscribe();
    }, []);

    // Subscribe to messages of selected conversation
    useEffect(() => {
        if (selectedConversation) {
            const messagesRef = collection(db, 'chatConversations', selectedConversation.id, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const msgs = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const timestamp = data.timestamp?.toDate?.() || null;
                    
                    msgs.push({
                        id: doc.id,
                        ...data,
                        timestamp: timestamp ? formatFirebaseTimestamp(timestamp) : ''
                    });
                });
    
                // Sort messages by their original timestamp
                const sortedMsgs = msgs.sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return timeA - timeB;
                });
    
                setMessages(sortedMsgs);
            });
    
            return () => unsubscribe();
        }
    }, [selectedConversation]);

    const handleTakeOver = async () => {
        if (!selectedConversation) return;
        
        try {
            await setDoc(doc(db, 'chatConversations', selectedConversation.id), {
                status: 'agent-handling',
                agentId: 'current-agent-id',
                takenOverAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
                botEnabled: false // Signal to stop ChatGPT
            }, { merge: true });

            await addDoc(collection(db, 'chatConversations', selectedConversation.id, 'messages'), {
                content: 'Conversation taken over by agent',
                role: 'system',
                timestamp: serverTimestamp()
            });

            setIsTakenOver(true);
            setSelectedConversation(prev => ({...prev, status: 'agent-handling'}));
        } catch (error) {
            console.error('Error taking over:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!agentMessage.trim() || !selectedConversation) return;
    
        try {
            const messagesRef = collection(db, 'chatConversations', selectedConversation.id, 'messages');
            const timestamp = serverTimestamp();
    
            // Add message
            await addDoc(messagesRef, {
                content: agentMessage,
                role: 'agent',
                timestamp
            });
    
            // Update conversation metadata
            await setDoc(doc(db, 'chatConversations', selectedConversation.id), {
                lastMessage: agentMessage,
                lastMessageAt: timestamp,
                lastUpdated: timestamp,
                lastMessageRole: 'agent',
                status: 'agent-handling'
            }, { merge: true });
    
            setAgentMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };
    
    // Update the messages render section
    {messages.map((message, index) => (
        <div
            key={message.id || index}
            className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
            }`}
        >
            <div
                className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === "user"
                        ? "bg-blue-500 text-white"
                        : message.role === "agent"
                        ? "bg-green-500 text-white"
                        : message.role === "system"
                        ? "bg-yellow-100 text-gray-800"
                        : "bg-gray-100 text-gray-800"
                }`}
            >
                <div className="text-sm">
                    {message.content}
                </div>
                <div className={`text-xs ${
                    message.role === "user" 
                        ? "text-blue-100"
                        : message.role === "agent"
                        ? "text-green-100" 
                        : "text-gray-500"
                } mt-1`}>
                    {message.timestamp}
                </div>
            </div>
        </div>
    ))}

    // Rest of your render code remains the same...
    return (
    <div className="h-screen p-6">
        <div className="max-w-7xl mx-auto h-full">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Chatbot Monitor</h1>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
                {/* Fixed Left Sidebar */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow flex flex-col">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-semibold">Recent Conversations</h2>
                    </div>
                    <div className="divide-y overflow-y-auto flex-1">
                        {conversations.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">No conversations found</div>
                        ) : (
                            conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                                        selectedConversation?.id === conv.id ? "bg-blue-50" : ""
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">{conv.fullName || 'Anonymous User'}</span>
                                        {conv.status === "completed" ? (
                                            <CheckCircle size={16} className="text-green-500" />
                                        ) : conv.status === "agent-handling" ? (
                                            <User size={16} className="text-blue-500" />
                                        ) : (
                                            <AlertCircle size={16} className="text-yellow-500" />
                                        )}
                                    </div>
                                    {conv.lastMessageAt && (
                                        <div className="text-sm text-gray-500">
                                            {new Date(conv.lastMessageAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Scrollable Right Content */}
                <div className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col h-full">
                    {selectedConversation ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b">
                                <h2 className="text-lg font-semibold">Conversation Details</h2>
                                <p className="text-sm text-gray-500">
                                    Customer: {selectedConversation.fullName || 'Anonymous User'}
                                </p>
                                {!isTakenOver && (
                                    <button
                                        onClick={handleTakeOver}
                                        className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        Take Over Conversation
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                                    {messages.map((message, index) => (
                                        <div
                                            key={message.id || index}
                                            className={`flex ${
                                                message.role === "user" ? "justify-end" : "justify-start"
                                            }`}
                                        >
                                            <div
                                                className={`max-w-[80%] p-3 rounded-lg ${
                                                    message.role === "user"
                                                        ? "bg-blue-500 text-white"
                                                        : message.role === "agent"
                                                        ? "bg-green-500 text-white"
                                                        : "bg-gray-100 text-gray-800"
                                                }`}
                                            >
                                                <div className="text-sm">
                                                    {message.content}
                                                </div>
                                                <div className={`text-xs ${
                                                    message.role === "user" 
                                                        ? "text-blue-100"
                                                        : message.role === "agent"
                                                        ? "text-green-100" 
                                                        : "text-gray-500"
                                                } mt-1`}>
                                                    {message.timestamp}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {isTakenOver && (
                                    <div className="p-4 border-t bg-white">
                                        <form onSubmit={handleSendMessage} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={agentMessage}
                                                onChange={(e) => setAgentMessage(e.target.value)}
                                                placeholder="Type your message..."
                                                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!agentMessage.trim()}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                            >
                                                Send
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Select a conversation to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
);
};

export default ChatbotSettings;