// ChatbotSettings.jsx
import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, User } from 'lucide-react';
import { chatService } from './chatService';

const ChatbotSettings = () => {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribe = chatService.subscribeToConversations((updatedConversations) => {
            console.log('Received conversations:', updatedConversations);
            setConversations(updatedConversations);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadMessages = async () => {
            if (selectedConversation) {
                const msgs = await chatService.getMessages(selectedConversation.id);
                setMessages(msgs);
            }
        };

        loadMessages();
    }, [selectedConversation]);

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        
        try {
            // Handle Firestore timestamp
            if (timestamp?.seconds) {
                return new Date(timestamp.seconds * 1000).toLocaleString();
            }
            
            // Handle ISO string
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return new Date(timestamp.replace(' UTC+1', '')).toLocaleString();
            }
            return date.toLocaleString();
        } catch (error) {
            console.error('Date parsing error:', error);
            return timestamp; // Return original string if parsing fails
        }
    };

    const takeOverConversation = async (conversationId) => {
        const agentId = 'current-agent-id'; // Replace with actual agent ID
        const success = await chatService.takeOverConversation(conversationId, agentId);
        
        if (!success) {
            setError('Failed to take over conversation. Please try again.');
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Chatbot Monitor</h1>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Conversations List */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-semibold">Recent Conversations</h2>
                    </div>
                    <div className="divide-y max-h-[600px] overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
                        ) : conversations.length === 0 ? (
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
                                        <span className="font-medium">{conv.customerEmail || 'Anonymous User'}</span>
                                        {conv.status === "completed" ? (
                                            <CheckCircle size={16} className="text-green-500" />
                                        ) : conv.status === "agent-handling" ? (
                                            <User size={16} className="text-blue-500" />
                                        ) : (
                                            <AlertCircle size={16} className="text-yellow-500" />
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {formatDate(conv.lastMessageAt || conv.createdAt)}
                                    </div>
                                    {conv.messages?.length > 0 && (
                                        <div className="mt-2 text-sm text-gray-600 truncate">
                                            {conv.messages[conv.messages.length - 1].content}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Conversation Details */}
                <div className="lg:col-span-2 bg-white rounded-lg shadow">
                    {selectedConversation ? (
                        <div className="h-full flex flex-col">
                            <div className="p-4 border-b">
                                <h2 className="text-lg font-semibold">Conversation Details</h2>
                                <p className="text-sm text-gray-500">
                                    Customer: {selectedConversation.customerEmail || 'Anonymous User'}
                                </p>
                                <button
                                    onClick={() => takeOverConversation(selectedConversation.id)}
                                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Take Over Conversation
                                </button>
                            </div>
                            <div className="flex-1 p-4 space-y-4 max-h-[600px] overflow-y-auto">
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
                                                    : "bg-gray-100 text-gray-800"
                                            }`}
                                        >
                                            <div className="text-sm">
                                                {message.content}
                                            </div>
                                            <div className={`text-xs ${
                                                message.role === "user" 
                                                    ? "text-blue-100" 
                                                    : "text-gray-500"
                                            } mt-1`}>
                                                {formatDate(message.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {messages.length === 0 && (
                                    <div className="text-center text-gray-500">
                                        No messages in this conversation
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
    );
};

export default ChatbotSettings;