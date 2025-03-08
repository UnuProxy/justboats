import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, User, ArrowLeft, Clock, Trash2, Search, XCircle, Check, Calendar, Filter } from 'lucide-react';
import { db } from '../firebase/firebaseConfig.js';
import { collection, onSnapshot, doc, addDoc, setDoc, serverTimestamp, query, orderBy, writeBatch, where, Timestamp, getDocs } from 'firebase/firestore';

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
    
    // New state for date filtering
    const [dateFilter, setDateFilter] = useState('all');
    const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        let q = query(collection(db, 'chatConversations'), orderBy('lastMessageAt', 'desc'));
        
        // Apply date filter if not 'all'
        if (dateFilter !== 'all') {
            let startDate;
            const now = new Date();
            const endDate = new Date(now.setHours(23, 59, 59, 999)); // End of today
            
            switch (dateFilter) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
                    break;
                case 'yesterday':
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 1);
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(now);
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'custom':
                    if (customDateRange.start && customDateRange.end) {
                        startDate = new Date(customDateRange.start);
                        startDate.setHours(0, 0, 0, 0);
                        const endDateCustom = new Date(customDateRange.end);
                        endDateCustom.setHours(23, 59, 59, 999);
                        q = query(
                            collection(db, 'chatConversations'),
                            where('lastMessageAt', '>=', Timestamp.fromDate(startDate)),
                            where('lastMessageAt', '<=', Timestamp.fromDate(endDateCustom)),
                            orderBy('lastMessageAt', 'desc')
                        );
                    }
                    break;
                default:
                    break;
            }
            
            if (dateFilter !== 'custom' && startDate) {
                q = query(
                    collection(db, 'chatConversations'),
                    where('lastMessageAt', '>=', Timestamp.fromDate(startDate)),
                    where('lastMessageAt', '<=', Timestamp.fromDate(endDate)),
                    orderBy('lastMessageAt', 'desc')
                );
            }
        }
        
        // Apply status filter if not 'all'
        if (statusFilter !== 'all' && dateFilter === 'all') {
            q = query(
                collection(db, 'chatConversations'),
                where('status', '==', statusFilter),
                orderBy('lastMessageAt', 'desc')
            );
        } else if (statusFilter !== 'all') {
            // We need to recreate the query with both date and status filters
            // Note: This is a simplification - Firebase has limitations on compound queries
            // For production, you might need to use a more complex indexing strategy
            const filteredConvs = conversations.filter(conv => conv.status === statusFilter);
            setConversations(filteredConvs);
            return;
        }
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const convs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                lastMessageAt: formatFirebaseTimestamp(doc.data().lastMessageAt)
            }));
            setConversations(convs);
        });
        
        return () => unsubscribe();
    }, [dateFilter, customDateRange, statusFilter]);

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

    // Function to delete a single conversation
    const handleDeleteConversation = async (convId, e) => {
        e.stopPropagation(); // Prevent conversation selection
        setIsDeleting(true);
        
        try {
            // Delete all messages
            const messagesRef = collection(db, 'chatConversations', convId, 'messages');
            const messagesSnapshot = await getDocs(query(messagesRef));
            
            const batch = writeBatch(db);
            messagesSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete conversation document
            batch.delete(doc(db, 'chatConversations', convId));
            await batch.commit();
            
            // Update UI if deleted conversation is currently selected
            if (selectedConversation?.id === convId) {
                setSelectedConversation(null);
                setShowMobileList(true);
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
        } finally {
            setIsDeleting(false);
        }
    };
    
    const handleDeleteConversations = async () => {
        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            
            for (const convId of selectedConversations) {
                // Delete all messages in the conversation
                const messagesRef = collection(db, 'chatConversations', convId, 'messages');
                const messagesSnapshot = await getDocs(query(messagesRef));
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
    
    // Function to export conversation as JSON or CSV
    const handleExportConversation = async (format = 'json') => {
        if (!selectedConversation) return;
        
        setIsExporting(true);
        try {
            // Fetch all messages for the conversation
            const messagesRef = collection(db, 'chatConversations', selectedConversation.id, 'messages');
            const messagesSnapshot = await getDocs(query(messagesRef, orderBy('timestamp', 'asc')));
            
            const exportData = {
                conversation: {
                    id: selectedConversation.id,
                    userName: selectedConversation.userName || 'Anonymous',
                    status: selectedConversation.status,
                    startedAt: selectedConversation.createdAt || 'Unknown',
                    lastMessageAt: selectedConversation.lastMessageAt
                },
                messages: messagesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    timestamp: formatFirebaseTimestamp(doc.data().timestamp)
                }))
            };
            
            let dataStr;
            let filename;
            
            if (format === 'json') {
                dataStr = JSON.stringify(exportData, null, 2);
                filename = `conversation_${selectedConversation.id}.json`;
            } else if (format === 'csv') {
                // Create CSV string with headers
                const headers = ['MessageID', 'Role', 'Content', 'Timestamp'];
                const rows = exportData.messages.map(msg => 
                    [msg.id, msg.role, msg.content.replace(/"/g, '""'), msg.timestamp]
                );
                dataStr = [
                    headers.join(','),
                    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                ].join('\n');
                filename = `conversation_${selectedConversation.id}.csv`;
            }
            
            // Create download link
            const blob = new Blob([dataStr], { type: format === 'json' ? 'application/json' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting conversation:', error);
        } finally {
            setIsExporting(false);
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
    
    // Date filter preset options
    const dateFilterOptions = [
        { value: 'all', label: 'All Time' },
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'week', label: 'Last 7 Days' },
        { value: 'month', label: 'Last 30 Days' },
        { value: 'custom', label: 'Custom Range' }
    ];
    
    // Status filter options
    const statusFilterOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'agent-handling', label: 'Agent Handling' },
        { value: 'completed', label: 'Completed' }
    ];

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            <div className="p-4 bg-white border-b shadow-sm">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Chatbot Monitor</h1>
                    <div className="flex space-x-2">
                        {selectedConversation && (
                            <div className="relative">
                                <button
                                    onClick={() => handleExportConversation('json')}
                                    disabled={isExporting}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                                             disabled:bg-gray-400 transition-colors duration-150"
                                >
                                    {isExporting ? 'Exporting...' : 'Export'}
                                </button>
                            </div>
                        )}
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
                        
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800">Recent Conversations</h2>
                            <div className="flex space-x-2">
                                {/* Date Filter Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowDateFilter(!showDateFilter);
                                            setShowStatusFilter(false);
                                        }}
                                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors duration-150 
                                                 flex items-center"
                                    >
                                        <Calendar className="w-4 h-4 text-gray-600" />
                                    </button>
                                    
                                    {showDateFilter && (
                                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg 
                                                       z-10 w-56 py-2 border">
                                            {dateFilterOptions.map(option => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => {
                                                        setDateFilter(option.value);
                                                        if (option.value !== 'custom') {
                                                            setShowDateFilter(false);
                                                        }
                                                    }}
                                                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 
                                                              ${dateFilter === option.value ? 'bg-blue-50 text-blue-600' : ''}`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                            
                                            {dateFilter === 'custom' && (
                                                <div className="px-4 py-2 border-t mt-1">
                                                    <div className="mb-2">
                                                        <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                                                        <input 
                                                            type="date" 
                                                            value={customDateRange.start || ''}
                                                            onChange={(e) => setCustomDateRange(prev => ({
                                                                ...prev, 
                                                                start: e.target.value
                                                            }))}
                                                            className="w-full p-1 border rounded text-sm"
                                                        />
                                                    </div>
                                                    <div className="mb-2">
                                                        <label className="block text-sm text-gray-700 mb-1">End Date</label>
                                                        <input 
                                                            type="date"
                                                            value={customDateRange.end || ''}
                                                            onChange={(e) => setCustomDateRange(prev => ({
                                                                ...prev, 
                                                                end: e.target.value
                                                            }))}
                                                            className="w-full p-1 border rounded text-sm"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => setShowDateFilter(false)}
                                                        className="w-full py-1 bg-blue-600 text-white rounded text-sm mt-1"
                                                    >
                                                        Apply
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Status Filter Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowStatusFilter(!showStatusFilter);
                                            setShowDateFilter(false);
                                        }}
                                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors duration-150 
                                                 flex items-center"
                                    >
                                        <Filter className="w-4 h-4 text-gray-600" />
                                    </button>
                                    
                                    {showStatusFilter && (
                                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg 
                                                       z-10 w-56 py-2 border">
                                            {statusFilterOptions.map(option => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => {
                                                        setStatusFilter(option.value);
                                                        setShowStatusFilter(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 
                                                              ${statusFilter === option.value ? 'bg-blue-50 text-blue-600' : ''}`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Active Filters Display */}
                        {(dateFilter !== 'all' || statusFilter !== 'all') && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {dateFilter !== 'all' && (
                                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs flex items-center">
                                        <span>
                                            {dateFilter === 'custom' 
                                                ? `${new Date(customDateRange.start).toLocaleDateString()} - ${new Date(customDateRange.end).toLocaleDateString()}`
                                                : dateFilterOptions.find(o => o.value === dateFilter)?.label}
                                        </span>
                                        <button 
                                            onClick={() => setDateFilter('all')}
                                            className="ml-1 text-blue-500 hover:text-blue-700"
                                        >
                                            <XCircle className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                {statusFilter !== 'all' && (
                                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs flex items-center">
                                        <span>{statusFilterOptions.find(o => o.value === statusFilter)?.label}</span>
                                        <button 
                                            onClick={() => setStatusFilter('all')}
                                            className="ml-1 text-green-500 hover:text-green-700"
                                        >
                                            <XCircle className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
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
                                              "bg-blue-100" : ""} relative group`}
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
                                        <div className="flex items-center space-x-2">
                                            {getStatusIcon(conv.status)}
                                            <button
                                                onClick={(e) => handleDeleteConversation(conv.id, e)}
                                                className="w-7 h-7 p-1 rounded-full bg-red-100 text-red-500 opacity-0 
                                                        group-hover:opacity-100 hover:bg-red-200 hover:text-red-600 
                                                        focus:outline-none transition-opacity duration-150"
                                                aria-label="Delete conversation"
                                            >
                                                <Trash2 className="w-full h-full" />
                                            </button>
                                        </div>
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
                                    <div className="flex space-x-2">
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
                                        <button
                                            onClick={(e) => handleDeleteConversation(selectedConversation.id, e)}
                                            className="p-2 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 hover:text-red-600 
                                                     transition-colors duration-150 focus:outline-none focus:ring-2 
                                                     focus:ring-red-500 focus:ring-offset-2"
                                            aria-label="Delete conversation"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
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