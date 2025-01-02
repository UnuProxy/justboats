import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  PlusCircle, 
  Hotel, 
  Users, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  ChevronDown, 
  ChevronUp, 
  History,
  Download,
  FilterX
} from 'lucide-react';
import * as XLSX from 'xlsx';

const ManagePartners = () => {
  const [activeTab, setActiveTab] = useState('hotels');
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedPartnerHistory, setSelectedPartnerHistory] = useState(null);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    commissionRate: '',
    contactPerson: '',
    notes: ''
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    commissionRate: '',
    contactPerson: '',
    notes: ''
  });

  useEffect(() => {
    loadPartners();
  }, [activeTab]);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const collectionName = activeTab;
      const querySnapshot = await getDocs(collection(db, collectionName));
      const partnersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPartners(partnersData);
    } catch (error) {
      console.error('Error loading partners:', error);
      alert('Error loading partners. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadPartnerHistory = async (partnerId, partnerName) => {
    try {
      setHistoryLoading(true);
      setShowHistory(true);
      setSelectedPartnerHistory({ id: partnerId, name: partnerName });
  
      // Query bookings for this partner
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('selectedPartner', '==', partnerId)
      );
  
      const querySnapshot = await getDocs(q);
      const bookings = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  
      // Sort bookings by date on the client side if needed
      bookings.sort((a, b) => {
        const dateA = new Date(a.bookingDetails?.date || 0);
        const dateB = new Date(b.bookingDetails?.date || 0);
        return dateB - dateA; // descending order
      });
  
      setBookingHistory(bookings);
    } catch (error) {
      console.error('Error loading booking history:', error);
      alert('Error loading booking history. Please try again.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const collectionName = activeTab;
      
      const commissionRate = parseFloat(formData.commissionRate);
      if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        alert('Please enter a valid commission rate between 0 and 100');
        return;
      }
  
      await addDoc(collection(db, collectionName), {
        ...formData,
        commissionRate: commissionRate,
        createdAt: new Date().toISOString(),
        type: activeTab === 'hotels' ? 'hotel' : 'collaborator'
      });
  
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        commissionRate: '',
        contactPerson: '',
        notes: ''
      });
      
      setShowForm(false);
      await loadPartners();
      alert('Partner added successfully!');
    } catch (error) {
      console.error('Error adding partner:', error);
      alert('Error adding partner. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = (partner) => {
    setEditingId(partner.id);
    setEditFormData({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      address: partner.address,
      commissionRate: partner.commissionRate,
      contactPerson: partner.contactPerson,
      notes: partner.notes
    });
  };
  
  const handleSaveEdit = async (partnerId) => {
    try {
      setLoading(true);
      const docRef = doc(db, activeTab, partnerId);
      
      const commissionRate = parseFloat(editFormData.commissionRate);
      if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        alert('Please enter a valid commission rate between 0 and 100');
        return;
      }
  
      await updateDoc(docRef, {
        ...editFormData,
        commissionRate: commissionRate,
        lastUpdated: new Date().toISOString()
      });
  
      setEditingId(null);
      await loadPartners();
      alert('Partner updated successfully!');
    } catch (error) {
      console.error('Error updating partner:', error);
      alert('Error updating partner. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (partnerId) => {
    if (window.confirm('Are you sure you want to delete this partner?')) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, activeTab, partnerId));
        await loadPartners();
        alert('Partner deleted successfully!');
      } catch (error) {
        console.error('Error deleting partner:', error);
        alert('Error deleting partner. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setMinAmount('');
    setMaxAmount('');
  };

  const getFilteredBookings = (bookings) => {
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDetails.date);
      const bookingAmount = parseFloat(booking.pricing.finalPrice);

      if (dateRange.startDate && bookingDate < new Date(dateRange.startDate)) return false;
      if (dateRange.endDate && bookingDate > new Date(dateRange.endDate)) return false;
      if (minAmount && bookingAmount < parseFloat(minAmount)) return false;
      if (maxAmount && bookingAmount > parseFloat(maxAmount)) return false;

      return true;
    });
  };

  const downloadExcel = (filteredBookings) => {
    const exportData = filteredBookings.map(booking => ({
      'Date': new Date(booking.bookingDetails.date).toLocaleDateString(),
      'Client Name': booking.clientDetails.name,
      'Boat': booking.bookingDetails.boatName,
      'Amount': `€${booking.pricing.finalPrice}`,
      'Commission Rate': `${booking.commissionRate}%`,
      'Commission Amount': `€${(booking.pricing.finalPrice * booking.commissionRate / 100).toFixed(2)}`
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');

    let filename = `${selectedPartnerHistory.name}_bookings`;
    if (dateRange.startDate || dateRange.endDate) {
      filename += `_${dateRange.startDate || 'start'}_to_${dateRange.endDate || 'end'}`;
    }
    filename += '.xlsx';

    XLSX.writeFile(wb, filename);
  };

  const renderBookingHistory = () => {
    if (!showHistory) return null;

    const filteredBookings = getFilteredBookings(bookingHistory);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">
                Booking History - {selectedPartnerHistory?.name}
              </h3>
              <button 
                onClick={() => {
                  setShowHistory(false);
                  setSelectedPartnerHistory(null);
                  resetFilters();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="p-4 border-b bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Min Amount (€)</label>
                <input
                  type="number"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Amount (€)</label>
                <input
                  type="number"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>
            
            <div className="mt-4 flex justify-between">
              <button
                onClick={resetFilters}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <FilterX className="mr-2 h-4 w-4" />
                Reset Filters
              </button>
              <button
                onClick={() => downloadExcel(filteredBookings)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                disabled={filteredBookings.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Excel
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-350px)]">
            {historyLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredBookings.length === 0 ? (
              <p className="text-center text-gray-500">No bookings found matching the selected filters.</p>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((booking) => (
                  <div 
                    key={booking.id}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{booking.clientDetails.name}</p>
                        <p className="text-sm text-gray-600">
                          Date: {new Date(booking.bookingDetails.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          Boat: {booking.bookingDetails.boatName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">€{booking.pricing.finalPrice}</p>
                        <p className="text-sm text-blue-600">
                          Commission Rate: {booking.commissionRate}%
                        </p>
                        <p className="text-sm text-green-600">
                          Commission: €{(booking.pricing.finalPrice * booking.commissionRate / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Manage Partners</h2>
        
        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('hotels')}
            className={`flex items-center px-4 py-2 rounded-lg ${
              activeTab === 'hotels'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            <Hotel className="mr-2 h-5 w-5" />
            Hotels
          </button>
          <button
            onClick={() => setActiveTab('collaborators')}
            className={`flex items-center px-4 py-2 rounded-lg ${
              activeTab === 'collaborators'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            <Users className="mr-2 h-5 w-5" />
            Collaborators
          </button>
        </div>

        {/* Toggle Form Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="mb-4 flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          {showForm ? (
            <>
              <ChevronUp className="mr-2 h-5 w-5" />
              Hide Form
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-5 w-5" />
              Add New {activeTab === 'hotels' ? 'Hotel' : 'Collaborator'}
            </>
          )}
        </button>

        {/* Collapsible Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h3 className="text-lg font-semibold mb-4">Add New {activeTab === 'hotels' ? 'Hotel' : 'Collaborator'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full p-2 border rounded"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  className="mt-1 w-full p-2 border rounded"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  required
                  className="mt-1 w-full p-2 border rounded"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Commission Rate (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  className="mt-1 w-full p-2 border rounded"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full p-2 border rounded"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full p-2 border rounded"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  className="mt-1 w-full p-2 border rounded"
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center"
                >
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Add {activeTab === 'hotels' ? 'Hotel' : 'Collaborator'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Partners List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {activeTab === 'hotels' ? 'Hotels' : 'Collaborators'} List
            </h3>
            
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : partners.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No {activeTab === 'hotels' ? 'hotels' : 'collaborators'} found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {partners.map((partner) => (
                      <tr key={partner.id}>
                        <td className="px-6 py-4">
                          {editingId === partner.id ? (
                            <input
                              type="text"
                              className="w-full p-1 border rounded"
                              value={editFormData.name}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                            />
                          ) : (
                            <div>
                              <div className="font-medium">{partner.name}</div>
                              <div className="text-sm text-gray-500">{partner.address}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingId === partner.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                className="w-full p-1 border rounded"
                                value={editFormData.contactPerson}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                                placeholder="Contact Person"
                              />
                              <input
                                type="email"
                                className="w-full p-1 border rounded"
                                value={editFormData.email}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                              />
                            </div>
                          ) : (
                            <div>
                              <div>{partner.contactPerson}</div>
                              <div className="text-sm text-gray-500">{partner.email}</div>
                              <div className="text-sm text-gray-500">{partner.phone}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingId === partner.id ? (
                            <input
                              type="number"
                              className="w-20 p-1 border rounded"
                              value={editFormData.commissionRate}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                            />
                          ) : (
                            <div className="text-sm">
                              {partner.commissionRate}%
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 space-x-2">
                          {editingId === partner.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(partner.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Save className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(partner)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(partner.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => loadPartnerHistory(partner.id, partner.name)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <History className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Booking History Modal */}
      {renderBookingHistory()}
    </div>
  );
};

export default ManagePartners;