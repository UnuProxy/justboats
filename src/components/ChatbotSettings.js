import React, { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, CheckCircle, AlertCircle, User } from "lucide-react";

const ChatbotSettings = () => {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedConversation, setSelectedConversation] = useState(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        setIsLoading(true);
        try {
            // Replace with your actual API call
            const mockData = [
                {
                    id: 1,
                    customerEmail: "customer@example.com",
                    startTime: "2024-01-12T14:30:00",
                    status: "in-progress",
                    messages: [
                        { role: "user", content: "I want to book a yacht for next weekend" },
                        { role: "assistant", content: "I can help you with that. What size yacht are you interested in?" },
                        { role: "user", content: "A medium-sized yacht would be great!" },
                    ],
                },
                // Add more mock conversations as needed
            ];
            setConversations(mockData);
        } catch (error) {
            console.error("Error fetching conversations:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const takeOverConversation = (conversationId) => {
        console.log(`Taking over conversation with ID: ${conversationId}`);
        // Add logic to flag the conversation for manual intervention
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Chatbot Monitor</h1>
                <button
                    onClick={fetchConversations}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <RefreshCw size={20} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Conversations List */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-semibold">Recent Conversations</h2>
                    </div>
                    <div className="divide-y max-h-[600px] overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
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
                                        <span className="font-medium">{conv.customerEmail}</span>
                                        {conv.status === "completed" ? (
                                            <CheckCircle size={16} className="text-green-500" />
                                        ) : conv.status === "in-progress" ? (
                                            <User size={16} className="text-blue-500" />
                                        ) : (
                                            <AlertCircle size={16} className="text-yellow-500" />
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500">{formatDate(conv.startTime)}</div>
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
                                    Customer: {selectedConversation.customerEmail}
                                </p>
                                <button
                                    onClick={() => takeOverConversation(selectedConversation.id)}
                                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Take Over Conversation
                                </button>
                            </div>
                            <div className="flex-1 p-4 space-y-4 max-h-[600px] overflow-y-auto">
                                {selectedConversation.messages.map((message, index) => (
                                    <div
                                        key={index}
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
                                            {message.content}
                                        </div>
                                    </div>
                                ))}
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
