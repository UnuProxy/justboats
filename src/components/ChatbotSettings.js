import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, User, ArrowLeft, Clock, Trash2,  Search, XCircle, Check } from 'lucide-react';
import { db } from '../firebase/firebaseConfig.js';
import { collection, onSnapshot, doc, addDoc, setDoc, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore';

const formatFirebaseTimestamp = (timestamp) => {
    if (!timestamp) return '';
    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000).toLocaleString();
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString();
    if (timestamp instanceof Date) return timestamp.toLocaleString();
    return '';
};

const ChatbotSettings = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [agentMessage, setAgentMessage] = useState('');
    const [isTakenOver, setIsTakenOver] = useState(false);
    const [showMobileList, setShowMobileList] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConversations, setSelectedConversations] = useState(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(
            query(collection(db, 'chatConversations'), orderBy('lastMessageAt', 'desc')),
            (snapshot) => {
                const convs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    lastMessageAt: formatFirebaseTimestamp(doc.data().lastMessageAt)
                }));
                setConversations(convs);
            }
        );
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!selectedConversation) return;

        const messagesRef = collection(db, 'chatConversations', selectedConversation.id, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: formatFirebaseTimestamp(doc.data().timestamp)
            }));
            
            setMessages(newMessages.reverse());
            setTimeout(scrollToBottom, 100);
        });

        return () => {
            unsubscribe();
            setMessages([]);
        };
    }, [selectedConversation]);

    const handleConversationSelect = (conv, isMultiSelect = false) => {
        if (isMultiSelect) {
            const newSelected = new Set(selectedConversations);
            if (newSelected.has(conv.id)) {
                newSelected.delete(conv.id);
            } else {
                newSelected.add(conv.id);
            }
            setSelectedConversations(newSelected);
            return;
        }

        setSelectedConversation(conv);
        setMessages([]);
        setShowMobileList(false);
        setIsTakenOver(conv.status === 'agent-handling');
        setSelectedConversations(new Set());
    };

    const handleBackToList = () => {
        setShowMobileList(true);
        setSelectedConversation(null);
    };

    
    const handleDeleteConversations = async () => {
        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            
            for (const convId of selectedConversations) {
                // Delete all messages in the conversation
                const messagesRef = collection(db, 'chatConversations', convId, 'messages');
                const messagesSnapshot = await query(messagesRef).get();
                messagesSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                // Delete the conversation document
                batch.delete(doc(db, 'chatConversations', convId));
            }
            
            await batch.commit();
            setSelectedConversations(new Set());
            if (selectedConversations.has(selectedConversation?.id)) {
                setSelectedConversation(null);
                setShowMobileList(true);
            }
        } catch (error) {
            console.error('Error deleting conversations:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleTakeOver = async () => {
        if (!selectedConversation) return;
        
        try {
            await setDoc(doc(db, 'chatConversations', selectedConversation.id), {
                status: 'agent-handling',
                agentId: 'current-agent-id',
                takenOverAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
                botEnabled: false
            }, { merge: true });

            await addDoc(collection(db, 'chatConversations', selectedConversation.id, 'messages'), {
                content: 'An agent has joined the conversation',
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
    
            await addDoc(messagesRef, {
                content: agentMessage,
                role: 'agent',
                timestamp
            });
    
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

    const filteredConversations = conversations.filter(conv => {
        const searchLower = searchQuery.toLowerCase();
        return (
            conv.userName?.toLowerCase().includes(searchLower) ||
            conv.fullName?.toLowerCase().includes(searchLower) ||
            conv.lastMessage?.toLowerCase().includes(searchLower)
        );
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-500';
            case 'agent-handling': return 'text-blue-500';
            default: return 'text-yellow-500';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className={`w-4 h-4 ${getStatusColor(status)} flex-shrink-0`} />;
            case 'agent-handling':
                return <User className={`w-4 h-4 ${getStatusColor(status)} flex-shrink-0`} />;
            default:
                return <AlertCircle className={`w-4 h-4 ${getStatusColor(status)} flex-shrink-0`} />;
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            <div className="p-4 bg-white border-b shadow-sm">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Chatbot Monitor</h1>
                    {selectedConversations.size > 0 && (
                        <button
                            onClick={handleDeleteConversations}
                            disabled={isDeleting}
                            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg 
                                     hover:bg-red-700 disabled:bg-gray-400 transition-colors duration-150"
                        >
                            {isDeleting ? (
                                <span>Deleting...</span>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    <span>Delete Selected ({selectedConversations.size})</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className={`
                    ${showMobileList ? 'flex' : 'hidden'}
                    md:flex
                    w-full md:w-96 flex-shrink-0 bg-white border-r flex-col
                `}>
                    <div className="p-4 border-b bg-gray-50">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none 
                                             focus:ring-2 focus:ring-blue-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 
                                                 text-gray-400 hover:text-gray-600"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800">Recent Conversations</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredConversations.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 flex flex-col items-center">
                                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                                <p>No conversations found</p>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    onClick={(e) => handleConversationSelect(conv, e.ctrlKey || e.metaKey)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 border-b transition-colors 
                                              duration-150 ${selectedConversations.has(conv.id) ? 
                                              "bg-blue-50" : ""} ${selectedConversation?.id === conv.id ? 
                                              "bg-blue-100" : ""}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            {selectedConversations.has(conv.id) && (
                                                <Check className="w-4 h-4 text-blue-500" />
                                            )}
                                            <span className="font-medium truncate text-gray-800">
                                                {conv.userName || conv.fullName || 'Anonymous User'}
                                            </span>
                                        </div>
                                        {getStatusIcon(conv.status)}
                                    </div>
                                    <div className="text-sm text-gray-600 truncate">
                                        {conv.lastMessage || 'No messages yet'}
                                    </div>
                                    {conv.lastMessageAt && (
                                        <div className="text-xs text-gray-500 mt-1 flex items-center">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {conv.lastMessageAt}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={`
                    ${!showMobileList ? 'flex' : 'hidden'}
                    md:flex
                    flex-1 flex-col bg-gray-50
                `}>
                    {selectedConversation ? (
                        <div className="flex-1 flex flex-col h-full">
                            <div className="p-4 bg-white border-b shadow-sm">
                                <div className="flex items-center justify-between">
                                    <button 
                                        onClick={handleBackToList}
                                        className="md:hidden p-2 hover:bg-gray-100 rounded-lg mr-2 
                                                 transition-colors duration-150"
                                    >
                                        <ArrowLeft className="w-6 h-6" />
                                    </button>
                                    <div className="flex-1">
                                        <h2 className="text-lg font-semibold text-gray-800">
                                            {selectedConversation.userName || 
                                             selectedConversation.fullName || 
                                             'Anonymous User'}
                                        </h2>
                                        <div className="flex items-center text-sm">
                                            <span className={`${getStatusColor(selectedConversation.status)} mr-1`}>
                                                ●
                                            </span>
                                            <span className="text-gray-600">
                                                {selectedConversation.status.replace('-', ' ')
                                                 .charAt(0).toUpperCase() + 
                                                 selectedConversation.status.slice(1).replace('-', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    {!isTakenOver && (
                                        <button
                                            onClick={handleTakeOver}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                                     transition-colors duration-150 focus:outline-none focus:ring-2 
                                                     focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                                        >
                                            Take Over
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-4">
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${
                                                message.role === "user" ? "justify-end" : "justify-start"
                                            }`}
                                        >
                                            <div
                                                className={`max-w-[85%] md:max-w-[70%] p-3 rounded-lg shadow-sm ${
                                                    message.role === "user"
                                                        ? "bg-blue-500 text-white"
                                                        : message.role === "agent"
                                                        ? "bg-green-500 text-white"
                                                        : message.role === "system"
                                                        ? "bg-yellow-100 text-gray-800"
                                                        : "bg-gray-100 text-gray-800"
                                                }`}
                                            >
                                                <div className="text-sm break-words whitespace-pre-wrap">
                                                    {message.content}
                                                </div>
                                                <div className={`text-xs mt-1 flex items-center ${
                                                    message.role === "user" 
                                                        ? "text-blue-100"
                                                        : message.role === "agent"
                                                        ? "text-green-100" 
                                                        : "text-gray-500"
                                                }`}>
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {message.timestamp}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {isTakenOver && (
                                <div className="p-4 bg-white border-t shadow-sm">
                                    <form onSubmit={handleSendMessage} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={agentMessage}
                                            onChange={(e) => setAgentMessage(e.target.value)}
                                            placeholder="Type your message..."
                                            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 
                                                     focus:ring-blue-500 bg-gray-50"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!agentMessage.trim()}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                                     disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors 
                                                     duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 
                                                     focus:ring-offset-2"
                                        >
                                            Send
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
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