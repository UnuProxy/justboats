import React, { useState, useEffect } from 'react';
import { 
    Users, 
    Calendar, 
    Building2, 
    Mail, 
    Phone, 
    User, 
    Search,
    Download,
    Eye,
    Trash2,
    X,
    Plus,
    Save,
    UserPlus
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";

const ClientDataDisplay = () => {
    const [contractClients, setContractClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    
    // Form state
    const [clients, setClients] = useState([{
        id: Date.now(),
        fullName: '',
        email: '',
        phoneNumber: ''
    }]);
    const [companyName, setCompanyName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'contractClients'), orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const clientsData = [];
            querySnapshot.forEach((doc) => {
                clientsData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            setContractClients(clientsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching contract clients:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const deleteEntry = async (id) => {
        if (window.confirm('Are you sure you want to delete this client data entry?')) {
            try {
                await deleteDoc(doc(db, 'contractClients', id));
            } catch (error) {
                console.error('Error deleting entry:', error);
                alert('Failed to delete entry');
            }
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'No date';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const exportToCSV = () => {
        const headers = ['Company', 'Client Name', 'Email', 'Phone', 'Created Date'];
        const rows = [];
        
        contractClients.forEach(entry => {
            entry.clients?.forEach(client => {
                rows.push([
                    entry.companyName || 'N/A',
                    client.fullName || 'N/A',
                    client.email || 'N/A',
                    client.phoneNumber || 'N/A',
                    formatDate(entry.createdAt)
                ]);
            });
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contract-clients-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const filteredData = contractClients.filter(entry => {
        const searchLower = searchTerm.toLowerCase();
        return (
            entry.companyName?.toLowerCase().includes(searchLower) ||
            entry.clients?.some(client => 
                client.fullName?.toLowerCase().includes(searchLower) ||
                client.email?.toLowerCase().includes(searchLower)
            )
        );
    });

    // Form functions
    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const validatePhone = (phone) => {
        const cleanPhone = phone.replace(/\D/g, '');
        return cleanPhone.length >= 9 && cleanPhone.length <= 15;
    };

    const formatPhoneNumber = (phone) => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length <= 3) return cleanPhone;
        if (cleanPhone.length <= 6) return `${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3)}`;
        if (cleanPhone.length <= 9) return `${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3, 6)} ${cleanPhone.slice(6)}`;
        return `${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3, 6)} ${cleanPhone.slice(6, 9)} ${cleanPhone.slice(9)}`;
    };

    const updateClient = (clientId, field, value) => {
        setClients(prevClients => 
            prevClients.map(client => {
                if (client.id === clientId) {
                    const updatedClient = { ...client, [field]: value };
                    if (field === 'phoneNumber') {
                        updatedClient.phoneNumber = formatPhoneNumber(value);
                    }
                    return updatedClient;
                }
                return client;
            })
        );
    };

    const addClient = () => {
        setClients(prev => [...prev, {
            id: Date.now() + Math.random(),
            fullName: '',
            email: '',
            phoneNumber: ''
        }]);
    };

    const removeClient = (clientId) => {
        if (clients.length > 1) {
            setClients(prev => prev.filter(client => client.id !== clientId));
        }
    };

    const validateForm = () => {
        return clients.every(client => 
            client.fullName.trim() && 
            validateEmail(client.email) && 
            validatePhone(client.phoneNumber)
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            alert('Please fill in all fields correctly');
            return;
        }

        setIsSubmitting(true);
        try {
            const cleanClientData = clients.map(client => ({
                fullName: client.fullName.trim(),
                email: client.email.trim(),
                phoneNumber: client.phoneNumber.trim()
            }));

            await addDoc(collection(db, 'contractClients'), {
                clients: cleanClientData,
                companyName: companyName.trim(),
                createdAt: serverTimestamp(),
                status: 'active'
            });

            // Reset form
            setClients([{ id: Date.now(), fullName: '', email: '', phoneNumber: '' }]);
            setCompanyName('');
            setShowAddForm(false);
            
        } catch (error) {
            console.error('Failed to save client data:', error);
            alert('Failed to save client data. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeForm = () => {
        setShowAddForm(false);
        setClients([{ id: Date.now(), fullName: '', email: '', phoneNumber: '' }]);
        setCompanyName('');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading client data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Contract Clients</h1>
                            <p className="text-gray-600 mt-1">Manage client information for rental contracts</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                <Plus size={20} />
                                <span className="font-medium">Add Clients</span>
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                <Download size={20} />
                                <span className="font-medium">Export</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Search and Stats */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1 max-w-md">
                            <div className="relative">
                                <Search size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search clients or companies..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Users size={18} />
                                <span className="font-medium">{contractClients.length} Total Entries</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Building2 size={18} />
                                <span className="font-medium">{filteredData.reduce((acc, entry) => acc + (entry.clients?.length || 0), 0)} Clients</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Display */}
                {filteredData.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                            <Users size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No client data found</h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                            {searchTerm ? 'No results match your search. Try adjusting your search terms.' : 'Start by adding your first client data for rental contracts.'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200"
                            >
                                <Plus size={20} />
                                <span>Add First Client</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden lg:block bg-white rounded-2xl shadow-sm border overflow-hidden">
                            {/* Table Header */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="col-span-3">Company & Date</div>
                                    <div className="col-span-2">Client Name</div>
                                    <div className="col-span-3">Email</div>
                                    <div className="col-span-2">Phone</div>
                                    <div className="col-span-2 text-center">Actions</div>
                                </div>
                            </div>

                            {/* Table Body */}
                            <div className="divide-y divide-gray-100">
                                {filteredData.map((entry) => (
                                    <React.Fragment key={entry.id}>
                                        {entry.clients?.map((client, clientIndex) => (
                                            <div key={`${entry.id}-${clientIndex}`} className="px-6 py-4 hover:bg-gray-50 transition-colors duration-150">
                                                <div className="grid grid-cols-12 gap-4 items-center">
                                                    {/* Company & Date */}
                                                    <div className="col-span-3">
                                                        {clientIndex === 0 ? (
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Building2 size={16} className="text-gray-400" />
                                                                    <span className="font-medium text-gray-900 truncate">
                                                                        {entry.companyName || 'No Company'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                                                    <Calendar size={14} />
                                                                    <span>{formatDate(entry.createdAt)}</span>
                                                                </div>
                                                                {(entry.clients?.length || 0) > 1 && (
                                                                    <div className="text-xs text-blue-600 mt-1">
                                                                        {entry.clients?.length} clients total
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-400 text-sm">
                                                                ↳ Same contract
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Client Name */}
                                                    <div className="col-span-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <User size={14} className="text-blue-600" />
                                                            </div>
                                                            <span className="font-medium text-gray-900 truncate">
                                                                {client.fullName}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Email */}
                                                    <div className="col-span-3">
                                                        <div className="flex items-center gap-2">
                                                            <Mail size={14} className="text-gray-400" />
                                                            <span className="text-gray-700 truncate" title={client.email}>
                                                                {client.email}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Phone */}
                                                    <div className="col-span-2">
                                                        <div className="flex items-center gap-2">
                                                            <Phone size={14} className="text-gray-400" />
                                                            <span className="text-gray-700">
                                                                {client.phoneNumber}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="col-span-2 flex items-center justify-center gap-2">
                                                        {clientIndex === 0 && (
                                                            <>
                                                                <button
                                                                    onClick={() => setSelectedEntry(entry)}
                                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                                                    title="View all clients in this contract"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteEntry(entry.id)}
                                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                                    title="Delete entire contract"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* Table Footer */}
                            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                    <div>
                                        Showing {filteredData.reduce((acc, entry) => acc + (entry.clients?.length || 0), 0)} clients 
                                        from {filteredData.length} contracts
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-blue-100 rounded-full"></div>
                                            <span>Contract entry</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                                            <span>Additional client</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-4">
                            {filteredData.map((entry) => (
                                <div key={entry.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                                    {/* Contract Header */}
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                                    <Building2 size={20} className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">
                                                        {entry.companyName || 'No Company'}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {formatDate(entry.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setSelectedEntry(entry)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => deleteEntry(entry.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {entry.clients?.length || 0} client{(entry.clients?.length || 0) !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Clients List */}
                                    <div className="divide-y divide-gray-100">
                                        {entry.clients?.map((client, index) => (
                                            <div key={index} className="p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mt-1">
                                                        <User size={16} className="text-gray-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-gray-900 mb-2">
                                                            {client.fullName}
                                                        </h4>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                                <Mail size={14} className="text-gray-400 flex-shrink-0" />
                                                                <span className="break-all">{client.email}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                                <Phone size={14} className="text-gray-400 flex-shrink-0" />
                                                                <span>{client.phoneNumber}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Add Form Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Add Client Data</h2>
                                    <p className="text-blue-100 mt-1">Create a new contract entry with client information</p>
                                </div>
                                <button 
                                    onClick={closeForm} 
                                    className="p-2 hover:bg-blue-800 rounded-xl transition-colors duration-200"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
                            <form onSubmit={handleSubmit} className="p-6">
                                {/* Company Name */}
                                <div className="mb-8">
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                        <Building2 size={18} className="inline mr-2" />
                                        Company Name
                                    </label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter company name (optional)"
                                    />
                                </div>

                                {/* Clients Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">Client Information</h3>
                                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                            {clients.length} client{clients.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {clients.map((client, index) => (
                                        <div key={client.id} className="border border-gray-200 rounded-2xl p-6 bg-gray-50">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                                        <span className="font-semibold text-blue-600">{index + 1}</span>
                                                    </div>
                                                    <h4 className="text-lg font-semibold text-gray-900">Client {index + 1}</h4>
                                                </div>
                                                {clients.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeClient(client.id)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                                                        title="Remove client"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                                        <User size={16} className="inline mr-2" />
                                                        Full Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={client.fullName}
                                                        onChange={(e) => updateClient(client.id, 'fullName', e.target.value)}
                                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                        placeholder="Enter full name"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                                        <Mail size={16} className="inline mr-2" />
                                                        Email Address *
                                                    </label>
                                                    <input
                                                        type="email"
                                                        value={client.email}
                                                        onChange={(e) => updateClient(client.id, 'email', e.target.value)}
                                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                        placeholder="Enter email address"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                                        <Phone size={16} className="inline mr-2" />
                                                        Phone Number *
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        value={client.phoneNumber}
                                                        onChange={(e) => updateClient(client.id, 'phoneNumber', e.target.value)}
                                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                        placeholder="Enter phone number"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Add Client Button */}
                                <div className="mt-6">
                                    <button
                                        type="button"
                                        onClick={addClient}
                                        className="flex items-center justify-center space-x-3 w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                                    >
                                        <UserPlus size={20} />
                                        <span className="font-medium">Add Another Client</span>
                                    </button>
                                </div>

                                {/* Form Actions */}
                                <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={closeForm}
                                        className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!validateForm() || isSubmitting}
                                        className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                            validateForm() && !isSubmitting
                                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save size={20} />
                                                <span>Save Client Data</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {selectedEntry && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Client Details</h2>
                                    <p className="text-gray-300 mt-1">Complete information for this contract entry</p>
                                </div>
                                <button
                                    onClick={() => setSelectedEntry(null)}
                                    className="p-2 hover:bg-gray-700 rounded-xl transition-colors duration-200"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                            {/* Company Info */}
                            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <Building2 size={24} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Company Information</h3>
                                        <p className="text-gray-600">Contract details and metadata</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Company Name</label>
                                        <p className="text-lg font-semibold text-gray-900 mt-1">
                                            {selectedEntry.companyName || 'No company specified'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Created Date</label>
                                        <p className="text-lg font-semibold text-gray-900 mt-1">
                                            {formatDate(selectedEntry.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Clients Info */}
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                        <Users size={24} className="text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Client Information</h3>
                                        <p className="text-gray-600">{selectedEntry.clients?.length || 0} clients in this contract</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {selectedEntry.clients?.map((client, index) => (
                                        <div key={index} className="border border-gray-200 rounded-2xl p-6 hover:shadow-sm transition-shadow duration-200">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                                    <span className="font-bold text-blue-600">{index + 1}</span>
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-900">Client {index + 1}</h4>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                                        <User size={14} />
                                                        Full Name
                                                    </label>
                                                    <p className="text-lg font-semibold text-gray-900 mt-1">{client.fullName}</p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                                        <Mail size={14} />
                                                        Email Address
                                                    </label>
                                                    <p className="text-lg font-semibold text-gray-900 mt-1 break-all">{client.email}</p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                                        <Phone size={14} />
                                                        Phone Number
                                                    </label>
                                                    <p className="text-lg font-semibold text-gray-900 mt-1">{client.phoneNumber}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDataDisplay;