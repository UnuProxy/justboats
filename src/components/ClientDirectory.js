import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { Phone, Mail, Book, Calendar, Edit2, X, Trash2 } from 'lucide-react';

const DeleteConfirmModal = ({ client, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-4">Delete Client</h2>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete {client.name}? This action cannot be undone.
        </p>
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
  );
};

const EditClientModal = ({ client, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: client.name || '',
    email: client.email || '',
    phone: client.phone || '',
    passportNumber: client.passportNumber || ''
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
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        passportNumber: formData.passportNumber,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">Edit Client Details</h2>

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
              type="text"
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

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
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
        getDocs(query(clientsRef, orderBy("createdAt", "desc"))),
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
          ...data,
          name: data.clientName || data.name || data.clientDetails?.name,
          email: data.clientEmail || data.email || data.clientDetails?.email,
          phone: data.clientPhone || data.phone || data.clientDetails?.phone,
          passportNumber: data.passportNumber || data.clientPassport || data.clientDetails?.passportNumber,
          source: data.source || '',
          clientType: data.clientType || (data.source === 'Website' ? 'Direct' : data.source),
          hotelName: data.hotelName || data.partnerDetails?.name,
          collaboratorName: data.collaboratorName || data.partnerDetails?.name,
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

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const renderBookingHistory = (client) => {
    if (!client.bookings?.length) return <p className="text-gray-500 text-sm">No bookings yet</p>;

    return (
      <div className="mt-4 space-y-3">
        <h4 className="font-medium">Booking History</h4>
        {client.bookings.map(booking => (
          <div key={booking.id} className="bg-gray-50 p-3 rounded-lg text-sm">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{booking.bookingDetails?.boatName || booking.boatName}</p>
                <div className="flex items-center text-gray-600">
                  <Calendar size={14} className="mr-1"/>
                  {formatDate(booking.bookingDetails?.date || booking.bookingDate)}
                </div>
              </div>
              <div className="text-right">
                <p>€{booking.pricing?.finalPrice || booking.finalPrice}</p>
                <span className={`text-xs px-2 py-1 rounded-full
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

  // Update the renderClientCard function to fix the layout:
const renderClientCard = (client) => (
  <div key={client.id} 
    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
  >
    <div onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
      <div className="flex justify-between items-start">
        <div className="flex-grow">
          <h3 className="font-semibold text-lg">{client.name}</h3>
          <div className="text-sm text-gray-500 mt-1">
            <span className={`px-2 py-1 rounded-full text-xs
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
        
        <div className="flex flex-col items-end">
          {/* Action buttons moved inside the right column */}
          <div className="flex space-x-1 mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingClient(client);
              }}
              className="p-1.5 text-gray-500 hover:text-blue-500 bg-gray-50 rounded-full hover:bg-gray-100"
              title="Edit client"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeletingClient(client);
              }}
              className="p-1.5 text-gray-500 hover:text-red-500 bg-gray-50 rounded-full hover:bg-gray-100"
              title="Delete client"
            >
              <Trash2 size={14} />
            </button>
          </div>
          
          {/* Bookings and Total info */}
          <div className="text-sm text-gray-600">
            <div className="flex items-center">
              <Book size={16} className="mr-2"/>Bookings: {client.totalBookings || 0}
            </div>
            <div className="flex items-center mt-1">
              Total Spent: €{client.totalSpent || 0}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center"><Mail size={16} className="mr-2"/>{client.email || '--'}</div>
        <div className="flex items-center"><Phone size={16} className="mr-2"/>{client.phone || '--'}</div>
      </div>

      {expandedClient === client.id && renderBookingHistory(client)}
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
    <div className="p-6">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Client Directory</h1>
          <input
            type="text"
            placeholder="Search clients..."
            className="border rounded-lg px-4 py-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex space-x-4">
          {['all', 'direct', 'hotel', 'collaborator'].map(type => (
            <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeType === type 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(renderClientCard)}
      </div>
    </div>

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