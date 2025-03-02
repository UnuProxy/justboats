import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, addDoc, where } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { Phone, Mail, Book, Calendar, Edit2, X, Trash2, Plus, Search } from 'lucide-react';


const modalClasses = {
  overlay: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
  container: "bg-white rounded-lg w-full max-w-md relative max-h-[90vh] overflow-y-auto",
  header: "sticky top-0 bg-white p-4 border-b",
  content: "p-4",
  footer: "sticky bottom-0 bg-white p-4 border-t"
};

const DeleteConfirmModal = ({ client, onClose, onConfirm }) => {
  return (
    <div className={modalClasses.overlay} onClick={onClose}>
      <div className={modalClasses.container} onClick={e => e.stopPropagation()}>
        <div className={modalClasses.header}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold">Delete Client</h2>
        </div>

        <div className={modalClasses.content}>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete {client.name}? This action cannot be undone.
          </p>
        </div>

        <div className={modalClasses.footer}>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditClientModal = ({ client, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: client.name || '',
    email: client.email || '',
    phone: client.phone || '',
    passportNumber: client.passportNumber || '',
    dob: client.dob || '',
    notes: client.notes || '',
    clientType: client.clientType || 'Direct',
    source: client.source || 'Manual Entry'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const clientRef = doc(db, 'clients', client.id);
      
      await updateDoc(clientRef, {
        ...formData,
        lastUpdated: new Date().toISOString()
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error updating client details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={modalClasses.overlay} onClick={onClose}>
      <div className={modalClasses.container} onClick={e => e.stopPropagation()}>
        <div className={modalClasses.header}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold">Edit Client Details</h2>
        </div>

        <div className={modalClasses.content}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Number</label>
              <input
                type="text"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                rows="3"
                placeholder="Enter client preferences, likes, dislikes, and any special notes..."
              />
            </div>
          </form>
        </div>

        <div className={modalClasses.footer}>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddClientModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    notes: '',
    clientType: 'Direct',
    source: 'Manual Entry'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if a client with the same email already exists
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef, where('email', '==', formData.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Client exists, update the existing document
        const existingDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'clients', existingDoc.id), {
          ...formData,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Create new client
        await addDoc(clientsRef, {
          ...formData,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }

      onAdd();
      onClose();
    } catch (error) {
      console.error('Error adding/updating client:', error);
      alert('Error saving client. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={modalClasses.overlay} onClick={onClose}>
      <div className={modalClasses.container} onClick={e => e.stopPropagation()}>
        <div className={modalClasses.header}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold">Add New Client</h2>
        </div>

        <div className={modalClasses.content}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded"
                rows="3"
                placeholder="Enter client preferences, likes, dislikes, and any special notes..."
              />
            </div>
          </form>
        </div>

        <div className={modalClasses.footer}>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Client'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientDirectory = () => {
  const [clients, setClients] = useState([]);
  const [activeType, setActiveType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-GB');
  };

  useEffect(() => {
    fetchClientsAndBookings();
  }, []);

  const handleDeleteClient = async (clientId) => {
    try {
      await deleteDoc(doc(db, 'clients', clientId));
      fetchClientsAndBookings();
      setDeletingClient(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error deleting client. Please try again.');
    }
  };

  const fetchClientsAndBookings = async () => {
    try {
      const clientsRef = collection(db, "clients");
      const bookingsRef = collection(db, "bookings");
      
      const [clientsSnap, bookingsSnap] = await Promise.all([
        getDocs(query(clientsRef, orderBy("lastUpdated", "desc"))),
        getDocs(bookingsRef)
      ]);

      const bookings = bookingsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const clientsData = clientsSnap.docs.map(doc => {
        const data = doc.data();
        const clientBookings = bookings.filter(b => b.clientId === doc.id);
        
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          passportNumber: data.passportNumber || '',
          dob: data.dob || '',
          notes: data.notes || '',
          source: data.source || 'Manual Entry',
          clientType: data.clientType || 'Direct',
          createdAt: data.createdAt || new Date().toISOString(),
          lastUpdated: data.lastUpdated || data.createdAt || new Date().toISOString(),
          bookings: clientBookings,
          totalBookings: clientBookings.length,
          totalSpent: clientBookings.reduce((sum, b) => sum + (parseFloat(b.pricing?.finalPrice) || 0), 0)
        };
      });

      setClients(clientsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const renderBookingHistory = (client) => {
    if (!client.bookings?.length) return <p className="text-gray-500 text-sm">No bookings yet</p>;
  
    return (
      <div className="mt-4 space-y-3">
        <h4 className="font-medium">Booking History</h4>
        {client.bookings.map(booking => (
          <div key={booking.id} className="bg-gray-50 p-3 rounded-lg text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
              <div>
                <p className="font-medium">{booking.bookingDetails?.boatName || booking.boatName}</p>
                <div className="flex items-center text-gray-600">
                  <Calendar size={14} className="mr-1"/>
                  {formatDate(booking.bookingDetails?.date || booking.bookingDate)}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p>€{booking.pricing?.finalPrice || booking.finalPrice}</p>
                <span className={`inline-block text-xs px-2 py-1 rounded-full
                  ${(booking.pricing?.paymentStatus || booking.paymentStatus) === 'Completed' ? 'bg-green-100 text-green-800' : 
                    (booking.pricing?.paymentStatus || booking.paymentStatus) === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'}`}>
                  {booking.pricing?.paymentStatus || booking.paymentStatus}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
    const renderClientCard = (client) => (
      <div key={client.id} 
        className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
      >
        <div onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex-grow">
              <h3 className="font-semibold text-lg break-words">{client.name}</h3>
              <div className="text-sm text-gray-500 mt-1">
                <span className={`inline-block px-2 py-1 rounded-full text-xs my-1
                  ${client.clientType === 'Direct' ? 'bg-green-100 text-green-800' :
                    client.clientType === 'Hotel' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'}`}>
                  {client.clientType}
                  {client.clientType === 'Direct' && client.source && ` - ${client.source}`}
                  {client.clientType === 'Hotel' && client.hotelName && ` - ${client.hotelName}`}
                  {client.clientType === 'Collaborator' && client.collaboratorName && ` - ${client.collaboratorName}`}
                </span>
              </div>
            </div>
            
            <div className="flex sm:flex-col items-start sm:items-end gap-4 sm:gap-2">
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingClient(client);
                  }}
                  className="p-2 text-gray-500 hover:text-blue-500 bg-gray-50 rounded-full hover:bg-gray-100"
                  title="Edit client"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingClient(client);
                  }}
                  className="p-2 text-gray-500 hover:text-red-500 bg-gray-50 rounded-full hover:bg-gray-100"
                  title="Delete client"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="text-sm text-gray-600">
                <div className="flex items-center">
                  <Book size={16} className="mr-2"/>
                  <span className="whitespace-nowrap">Bookings: {client.totalBookings || 0}</span>
                </div>
                <div className="flex items-center mt-1">
                  <span className="whitespace-nowrap">Total: €{client.totalSpent || 0}</span>
                </div>
              </div>
            </div>
          </div>
  
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center break-words">
              <Mail size={16} className="mr-2 flex-shrink-0"/>
              <span className="break-all">{client.email || '--'}</span>
            </div>
            <div className="flex items-center">
              <Phone size={16} className="mr-2 flex-shrink-0"/>
              <span>{client.phone || '--'}</span>
            </div>
            {client.dob && (
              <div className="flex items-center">
                <Calendar size={16} className="mr-2 flex-shrink-0"/>
                <span>DOB: {formatDate(client.dob)}</span>
              </div>
            )}
            {client.notes && (
              <div className="mt-2">
                <p className="font-medium">Notes:</p>
                <p className="text-gray-600 mt-1 break-words">{client.notes}</p>
              </div>
            )}
          </div>
  
          {expandedClient === client.id && renderBookingHistory(client)}
        </div>
      </div>
    );
  
    const renderMobileSearch = () => (
      <div className="fixed inset-x-0 top-0 bg-white p-4 shadow z-30">
        <div className="relative">
          <input
            type="text"
            placeholder="Search clients..."
            className="w-full border rounded-lg pl-10 pr-4 py-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          <button
            onClick={() => setShowMobileSearch(false)}
            className="absolute right-2 top-2 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  
    const filteredClients = clients.filter(client => {
      const isDirectClient = client.clientType === 'Direct' || ['Website', 'WhatsApp', 'Referral', 'Social Media'].includes(client.source);
      
      const matchesType = 
        activeType === 'all' || 
        (activeType === 'direct' && isDirectClient) ||
        (activeType === 'hotel' && client.clientType === 'Hotel') ||
        (activeType === 'collaborator' && client.clientType === 'Collaborator');
      
      const matchesSearch = !searchTerm || 
                           client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           client.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesType && matchesSearch;
    });
  
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"/>
        </div>
      );
    }
  
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col space-y-4 sm:space-y-6">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-xl sm:text-2xl font-bold">Client Directory</h1>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              {/* Search bar - hidden on mobile when mobile search is active */}
              <div className="hidden sm:block flex-grow sm:flex-grow-0">
                <input
                  type="text"
                  placeholder="Search clients..."
                  className="border rounded-lg px-4 py-2 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {/* Mobile search button */}
              <button
                onClick={() => setShowMobileSearch(true)}
                className="sm:hidden p-2 text-gray-600 hover:text-gray-800"
              >
                <Search size={24} />
              </button>
              {/* Add client button */}
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add Client</span>
              </button>
            </div>
          </div>
  
          {/* Filter buttons - scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="flex space-x-2 sm:space-x-4 min-w-max">
              {['all', 'direct', 'hotel', 'collaborator'].map(type => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`px-3 sm:px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    activeType === type 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
  
          {/* Client cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map(renderClientCard)}
          </div>
        </div>
  
        {/* Mobile search overlay */}
        {showMobileSearch && renderMobileSearch()}
  
        {/* Modals */}
        {showAddModal && (
          <AddClientModal
            onClose={() => setShowAddModal(false)}
            onAdd={() => {
              fetchClientsAndBookings();
              setShowAddModal(false);
            }}
          />
        )}
  
        {editingClient && (
          <EditClientModal
            client={editingClient}
            onClose={() => setEditingClient(null)}
            onUpdate={() => {
              fetchClientsAndBookings();
              setEditingClient(null);
            }}
          />
        )}
  
        {deletingClient && (
          <DeleteConfirmModal
            client={deletingClient}
            onClose={() => setDeletingClient(null)}
            onConfirm={() => handleDeleteClient(deletingClient.id)}
          />
        )}
      </div>
    );
  };
  
  export default ClientDirectory;