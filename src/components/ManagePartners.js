import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  getDoc
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
  // Add the missing state variable for partner editing
  const [editingId, setEditingId] = useState(null); 
  // Track which booking is currently being edited
  const [editingFeeId, setEditingFeeId] = useState(null);
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

  // State for commission inputs in booking history
  const [commissionInputs, setCommissionInputs] = useState({});

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
      
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('selectedPartner', '==', partnerId)
      );
  
      const querySnapshot = await getDocs(q);
      const bookings = querySnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Check both database paths for partner fee data (both new and old paths)
        const partnerPayments = data.partnerPayments || {};
        const ownerPayments = data.ownerPayments || {}; 
        
        // Check both payments status
        const firstPaymentReceived = data.pricing?.payments?.find(p => p.type === 'first')?.received || false;
        const secondPaymentReceived = data.pricing?.payments?.find(p => p.type === 'second')?.received || false;
        const bothPaymentsReceived = firstPaymentReceived && secondPaymentReceived;
  
        // Get the calculated commission based on price and rate
        const calculatedCommission = (data.pricing?.agreedPrice || 0) * (data.commissionRate || 0) / 100;
        
        // Check in both potential locations for existing data
        // First check partnerPayments, then fallback to ownerPayments for backward compatibility
        const isPaid = partnerPayments?.firstPayment?.paid || ownerPayments?.firstPayment?.paid || false;
        const paymentAmount = partnerPayments?.firstPayment?.amount || ownerPayments?.firstPayment?.amount || 0;
        const paymentNotes = partnerPayments?.firstPayment?.notes || ownerPayments?.firstPayment?.notes || '';
        const paymentDate = partnerPayments?.firstPayment?.date || ownerPayments?.firstPayment?.date || null;
        
        // Check if payment is in pending status - fallback for data without status
        const paymentStatus = partnerPayments?.firstPayment?.status || 
                             (ownerPayments?.firstPayment?.status) ||
                             (isPaid ? 'paid' : 'not_set');
        const isPending = paymentStatus === 'pending';
        
        console.log(`Booking ${doc.id} status:`, {
          partnerPayments,
          ownerPayments,
          isPaid,
          isPending,
          paymentStatus,
          paymentAmount
        });
        
        return {
          id: doc.id,
          bookingDate: data.bookingDetails?.date || '',
          clientName: data.clientName || '',
          boatName: data.bookingDetails?.boatName || '',
          amount: data.pricing?.agreedPrice || 0,
          firstPayment: {
            received: firstPaymentReceived,
            date: data.pricing?.payments?.find(p => p.type === 'first')?.date || null
          },
          secondPayment: {
            received: secondPaymentReceived,
            date: data.pricing?.payments?.find(p => p.type === 'second')?.date || null
          },
          bothPaymentsReceived,
          partnerFeePaid: isPaid,
          partnerFeePending: isPending,
          partnerFeeStatus: paymentStatus,
          partnerFeeAmount: paymentAmount,
          canPayPartnerFee: bothPaymentsReceived && !isPaid,
          calculatedFee: calculatedCommission,
          commissionRate: data.commissionRate || 0,
          partnerFeeNotes: paymentNotes,
          partnerFeeDate: paymentDate,
          data: data // Store full data for debugging
        };
      });
  
      bookings.sort((a, b) => {
        const dateA = new Date(a.bookingDate || 0);
        const dateB = new Date(b.bookingDate || 0);
        return dateB - dateA;
      });
  
      setBookingHistory(bookings);
      
      // Initialize commission inputs with calculated values or default to the calculated commission
      const initialInputs = {};
      bookings.forEach(booking => {
        initialInputs[booking.id] = {
          // Use existing amount if set, otherwise use calculated value
          amount: (booking.partnerFeePaid || booking.partnerFeePending) && booking.partnerFeeAmount > 0 
            ? booking.partnerFeeAmount 
            : booking.calculatedFee.toFixed(2),
          notes: booking.partnerFeeNotes || ''
        };
      });
      setCommissionInputs(initialInputs);
      
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

  const handleCommissionInputChange = (bookingId, field, value) => {
    setCommissionInputs(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [field]: value
      }
    }));
  };

  const handleSetPendingPartnerFee = async (bookingId) => {
    try {
      console.log('Setting pending for booking:', bookingId);
      
      const commissionData = commissionInputs[bookingId];
      if (!commissionData || commissionData.amount === undefined || commissionData.amount === '') {
        alert('Please enter a partner fee amount');
        return;
      }

      const amount = parseFloat(commissionData.amount);
      if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid partner fee amount (0 or positive number)');
        return;
      }
      const notes = commissionData.notes || '';
      const now = new Date().toISOString();
      
      // Get the current booking data
      const bookingSnapshot = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingSnapshot.exists()) {
        console.error('Booking not found:', bookingId);
        alert('Booking not found');
        return;
      }
      
      const bookingDataFromDb = bookingSnapshot.data();
      console.log('Current booking data:', bookingDataFromDb);
      
      // Create pending data object
      const pendingData = {
        amount: amount,
        notes: notes,
        status: 'pending',
        createdAt: now,
        paid: false
      };
      
      // Create complete update objects
      const bookingRef = doc(db, 'bookings', bookingId);
      
      // Create complete objects for both payment paths
      const partnerPaymentsUpdate = {
        ...bookingDataFromDb.partnerPayments,
        firstPayment: {
          ...(bookingDataFromDb.partnerPayments?.firstPayment || {}),
          ...pendingData
        }
      };
      
      const ownerPaymentsUpdate = {
        ...bookingDataFromDb.ownerPayments,
        firstPayment: {
          ...(bookingDataFromDb.ownerPayments?.firstPayment || {}),
          ...pendingData
        }
      };
      
      // Update both payment paths entirely
      await updateDoc(bookingRef, {
        partnerPayments: partnerPaymentsUpdate,
        ownerPayments: ownerPaymentsUpdate
      });
      
      console.log('Successfully marked payment as pending');
      setEditingFeeId(null); // Clear editing state after setting to pending

      await loadPartnerHistory(selectedPartnerHistory.id, selectedPartnerHistory.name);
      alert('Partner fee marked as pending');
    } catch (error) {
      console.error('Error setting pending partner fee:', error);
      alert('Error setting pending partner fee. Please try again.');
    }
  };

  const handlePayCommission = async (bookingId) => {
    try {
      console.log('Starting payment for booking:', bookingId);
      
      const commissionData = commissionInputs[bookingId];
      const booking = bookingHistory.find(b => b.id === bookingId);
      
      // If we're updating a pending fee, use the existing amount if it wasn't changed
      const amount = parseFloat(commissionData?.amount !== undefined ? commissionData.amount : (booking?.partnerFeeAmount || 0));
      const notes = commissionData?.notes || booking?.partnerFeeNotes || '';
      
      // Allow amount to be 0, but not negative or NaN
      if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid partner fee amount (0 or positive number)');
        return;
      }

      // Get the current booking data
      const bookingSnapshot = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingSnapshot.exists()) {
        console.error('Booking not found:', bookingId);
        alert('Booking not found');
        return;
      }
      
      const bookingDataFromDb = bookingSnapshot.data();
      console.log('Current booking data:', bookingDataFromDb);
      
      // Create payment data object
      const paymentData = {
        paid: true,
        date: new Date().toISOString(),
        amount: amount,
        notes: notes,
        paidBy: 'User',
        status: 'paid'
      };
      
      // Create complete update objects
      const bookingRef = doc(db, 'bookings', bookingId);
      
      // Create complete objects for both payment paths
      const partnerPaymentsUpdate = {
        ...bookingDataFromDb.partnerPayments,
        firstPayment: {
          ...(bookingDataFromDb.partnerPayments?.firstPayment || {}),
          ...paymentData
        }
      };
      
      const ownerPaymentsUpdate = {
        ...bookingDataFromDb.ownerPayments,
        firstPayment: {
          ...(bookingDataFromDb.ownerPayments?.firstPayment || {}),
          ...paymentData
        }
      };
      
      // Update both payment paths entirely
      await updateDoc(bookingRef, {
        partnerPayments: partnerPaymentsUpdate,
        ownerPayments: ownerPaymentsUpdate
      });
      
      console.log('Successfully marked payment as paid');
      setEditingFeeId(null); // Clear editing state after payment

      await loadPartnerHistory(selectedPartnerHistory.id, selectedPartnerHistory.name);
      alert('Partner payment recorded successfully!');
    } catch (error) {
      console.error('Error recording partner payment:', error);
      alert('Error recording partner payment. Please try again.');
    }
  };
  
  // Function to edit an existing commission payment
  const handleEditCommission = async (bookingId) => {
    try {
      console.log('Starting edit for booking:', bookingId);
      
      // Set this booking as being edited (for UI purposes)
      setEditingFeeId(bookingId);
      
      // Get the booking to determine where the data is stored
      const bookingSnapshot = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingSnapshot.exists()) {
        console.error('Booking not found:', bookingId);
        alert('Booking not found');
        setEditingFeeId(null); // Reset editing state
        return;
      }
      
      const bookingDataFromDb = bookingSnapshot.data();
      console.log('Current booking data:', bookingDataFromDb);
      
      // Create a complete update object that Firestore can understand
      const bookingRef = doc(db, 'bookings', bookingId);
      
      // Create objects that match the entire structure we want to update
      const partnerPaymentsUpdate = {
        ...bookingDataFromDb.partnerPayments,
        firstPayment: {
          ...(bookingDataFromDb.partnerPayments?.firstPayment || {}),
          paid: false,
          status: 'pending'
        }
      };
      
      const ownerPaymentsUpdate = {
        ...bookingDataFromDb.ownerPayments,
        firstPayment: {
          ...(bookingDataFromDb.ownerPayments?.firstPayment || {}),
          paid: false,
          status: 'pending'
        }
      };
      
      // Update both payment paths entirely
      await updateDoc(bookingRef, {
        partnerPayments: partnerPaymentsUpdate,
        ownerPayments: ownerPaymentsUpdate
      });
      
      console.log('Successfully updated booking to editable');
      
      // Reload the data but keep the editing state
      await loadPartnerHistory(selectedPartnerHistory.id, selectedPartnerHistory.name);
    } catch (error) {
      console.error('Error setting partner payment to editable:', error);
      alert('Error editing partner payment. Please try again.');
      setEditingFeeId(null); // Reset editing state on error
    }
  };

  const resetFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setMinAmount('');
    setMaxAmount('');
  };

  const getFilteredBookings = (bookings) => {
    return bookings.filter(booking => {
      // Safely handle dates and amounts with optional chaining and nullish coalescing
      const bookingDate = booking?.bookingDate ? new Date(booking.bookingDate) : null;
      const bookingAmount = parseFloat(booking?.amount || 0);
  
      // Date range filtering
      if (dateRange.startDate && bookingDate && bookingDate < new Date(dateRange.startDate)) return false;
      if (dateRange.endDate && bookingDate && bookingDate > new Date(dateRange.endDate)) return false;
  
      // Amount filtering
      if (minAmount && bookingAmount < parseFloat(minAmount)) return false;
      if (maxAmount && bookingAmount > parseFloat(maxAmount)) return false;
  
      return true;
    });
  };

  const downloadExcel = (filteredBookings) => {
    const exportData = filteredBookings.map(booking => ({
      'Date': booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : '-',
      'Client Name': booking.clientName || '-',
      'Boat': booking.boatName || '-',
      'Amount': `€${(booking.amount || 0)}`,
      'First Payment': booking.firstPayment && booking.firstPayment.received && booking.firstPayment.date ? 
        new Date(booking.firstPayment.date).toLocaleDateString() : 'Pending',
      'Second Payment': booking.secondPayment && booking.secondPayment.received && booking.secondPayment.date ? 
        new Date(booking.secondPayment.date).toLocaleDateString() : 'Pending',
      'Partner Fee Amount': `€${(booking.calculatedFee || 0).toFixed(2)}`,
      'Fee Paid': booking.partnerFeePaid ? 'Yes' : 'No',
      'Status': (booking.firstPayment && booking.firstPayment.received && 
                booking.secondPayment && booking.secondPayment.received && 
                booking.partnerFeePaid) ? 'Complete' : 'Pending'
    }));
  
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Partner Bookings');
  
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 20 }, // Client Name
      { wch: 20 }, // Boat
      { wch: 12 }, // Amount
      { wch: 15 }, // First Payment
      { wch: 15 }, // Second Payment
      { wch: 15 }, // Partner Fee Amount
      { wch: 15 }, // Fee Paid
      { wch: 12 }  // Status
    ];
  
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-lg max-w-full sm:max-w-4xl w-full max-h-[95vh] overflow-hidden">
          <div className="p-3 sm:p-6 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-semibold truncate">
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
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="p-3 sm:p-4 border-b bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Min Amount (€)</label>
                <input
                  type="number"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Max Amount (€)</label>
                <input
                  type="number"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>
            
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
              <button
                onClick={resetFilters}
                className="flex items-center justify-center sm:justify-start px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 w-full sm:w-auto"
              >
                <FilterX className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Reset Filters
              </button>
              <button
                onClick={() => downloadExcel(filteredBookings)}
                className="flex items-center justify-center sm:justify-start px-3 py-2 text-xs sm:text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 w-full sm:w-auto"
                disabled={filteredBookings.length === 0}
              >
                <Download className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Download Excel
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(95vh-250px)]">
            {historyLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredBookings.length === 0 ? (
              <p className="text-center text-gray-500">No bookings found matching the selected filters.</p>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-full sm:w-2/5">Booking Details</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell sm:w-1/5">Payment Status</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-full sm:w-2/5">Commission Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="flex flex-col sm:table-row hover:bg-gray-50 border-b sm:border-b-0 pb-3 sm:pb-0">
                        <td className="px-2 sm:px-4 py-2 sm:py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-start">
                              <div className="font-medium text-base sm:text-lg">{booking.clientName}</div>
                              <div className="text-xs sm:text-sm text-gray-500">ID: {booking.id.slice(-4)}</div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-xs sm:text-sm">
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <span className="ml-2 font-medium">{new Date(booking.bookingDate).toLocaleDateString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Boat:</span>
                                <span className="ml-2 font-medium">{booking.boatName}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Price:</span>
                                <span className="ml-2 font-medium text-blue-600">€{(booking.amount || 0).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Commission Rate:</span>
                                <span className="ml-2 font-medium text-purple-600">{booking.commissionRate}%</span>
                              </div>
                            </div>
                            <div className="mt-1 text-xs sm:text-sm">
                              <span className="text-gray-500">Expected Partner Fee:</span>
                              <span className="ml-2 font-medium text-green-600">
                                €{(booking.calculatedFee || 0).toLocaleString()}
                              </span>
                            </div>
                            
                            {/* Mobile Payment Status - Only show on mobile */}
                            <div className="flex flex-col gap-2 mt-2 sm:hidden">
                              <div className={`flex items-center gap-2 px-2 py-1 rounded-md ${
                                booking.firstPayment.received ? 'bg-green-100' : 'bg-yellow-100'
                              }`}>
                                <span className={`text-xs font-medium ${
                                  booking.firstPayment.received ? 'text-green-800' : 'text-yellow-800'
                                }`}>
                                  First Payment: {booking.firstPayment.received ? '✓' : 'Pending'}
                                </span>
                                {booking.firstPayment.received && (
                                  <span className="text-xs text-gray-600">
                                    {new Date(booking.firstPayment.date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              
                              <div className={`flex items-center gap-2 px-2 py-1 rounded-md ${
                                booking.secondPayment.received ? 'bg-green-100' : 'bg-yellow-100'
                              }`}>
                                <span className={`text-xs font-medium ${
                                  booking.secondPayment.received ? 'text-green-800' : 'text-yellow-800'
                                }`}>
                                  Second Payment: {booking.secondPayment.received ? '✓' : 'Pending'}
                                </span>
                                {booking.secondPayment.received && (
                                  <span className="text-xs text-gray-600">
                                    {new Date(booking.secondPayment.date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Desktop Payment Status - Hide on mobile */}
                        <td className="px-4 py-4 hidden sm:table-cell">
                          <div className="flex flex-col gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
                              booking.firstPayment.received ? 'bg-green-100' : 'bg-yellow-100'
                            }`}>
                              <span className={`text-sm font-medium ${
                                booking.firstPayment.received ? 'text-green-800' : 'text-yellow-800'
                              }`}>
                                First Payment: {booking.firstPayment.received ? '✓' : 'Pending'}
                              </span>
                              {booking.firstPayment.received && (
                                <span className="text-xs text-gray-600">
                                  {new Date(booking.firstPayment.date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
                              booking.secondPayment.received ? 'bg-green-100' : 'bg-yellow-100'
                            }`}>
                              <span className={`text-sm font-medium ${
                                booking.secondPayment.received ? 'text-green-800' : 'text-yellow-800'
                              }`}>
                                Second Payment: {booking.secondPayment.received ? '✓' : 'Pending'}
                              </span>
                              {booking.secondPayment.received && (
                                <span className="text-xs text-gray-600">
                                  {new Date(booking.secondPayment.date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-2 sm:px-4 py-2 sm:py-4">
                          {booking.bothPaymentsReceived ? (
                            <div className="space-y-3">
                              {(!booking.partnerFeePaid && !booking.partnerFeePending) || (editingFeeId === booking.id) ? (
                                <div className="bg-white p-2 sm:p-3 border rounded-md">
                                  <div className="space-y-2 sm:space-y-3">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Partner Fee Amount (€)</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
                                        value={commissionInputs[booking.id]?.amount || ''}
                                        onChange={(e) => handleCommissionInputChange(booking.id, 'amount', e.target.value)}
                                        placeholder="Enter amount"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                                      <textarea
                                        className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
                                        value={commissionInputs[booking.id]?.notes || ''}
                                        onChange={(e) => handleCommissionInputChange(booking.id, 'notes', e.target.value)}
                                        placeholder="Add any payment notes"
                                        rows="2"
                                      />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleSetPendingPartnerFee(booking.id);
                                        }}
                                        className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600"
                                      >
                                        Mark as Pending
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handlePayCommission(booking.id);
                                        }}
                                        className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                                      >
                                        Mark as Paid
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : booking.partnerFeePending ? (
                                <div className="bg-yellow-50 p-2 sm:p-3 rounded-md">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs sm:text-sm text-yellow-800 font-medium">Partner Fee Pending</div>
                                    <div className="flex gap-1 sm:gap-2">
                                      <button 
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('Edit button clicked for booking:', booking.id);
                                          handleEditCommission(booking.id);
                                        }}
                                        className="text-xs px-1 sm:px-2 py-0.5 sm:py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handlePayCommission(booking.id);
                                        }}
                                        className="text-xs px-1 sm:px-2 py-0.5 sm:py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                      >
                                        Mark Paid
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-600">Amount: €{booking.partnerFeeAmount}</div>
                                  {booking.partnerFeeNotes && (
                                    <div className="mt-2 p-1 sm:p-2 bg-white rounded text-xs text-gray-700">
                                      <span className="font-medium">Notes:</span> {booking.partnerFeeNotes}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-green-50 p-2 sm:p-3 rounded-md">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs sm:text-sm text-green-800 font-medium">Partner Fee Paid</div>
                                    <button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Edit button clicked for booking:', booking.id);
                                        handleEditCommission(booking.id);
                                      }}
                                      className="text-xs px-1 sm:px-2 py-0.5 sm:py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-600">Amount: €{booking.partnerFeeAmount}</div>
                                  <div className="text-xs text-gray-500">
                                    Date: {booking.partnerFeeDate ? new Date(booking.partnerFeeDate).toLocaleDateString() : 'N/A'}
                                  </div>
                                  {booking.partnerFeeNotes && (
                                    <div className="mt-2 p-1 sm:p-2 bg-white rounded text-xs text-gray-700">
                                      <span className="font-medium">Notes:</span> {booking.partnerFeeNotes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-yellow-50 p-2 sm:p-3 rounded-md">
                              <span className="text-xs sm:text-sm text-yellow-800">
                                Awaiting All Payments Before Partner Fee
                              </span>
                            </div>
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
    );
  };

  return (
    <div className="p-3 sm:p-6 max-w-full sm:max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Manage Partners</h2>
        
        {/* Tab Navigation */}
        <div className="flex flex-wrap sm:flex-nowrap space-x-2 sm:space-x-4 mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTab('hotels')}
            className={`flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg mb-2 sm:mb-0 ${
              activeTab === 'hotels'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            <Hotel className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            Hotels
          </button>
          <button
            onClick={() => setActiveTab('collaborators')}
            className={`flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg mb-2 sm:mb-0 ${
              activeTab === 'collaborators'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            <Users className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            Collaborators
          </button>
        </div>

        {/* Toggle Form Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="mb-3 sm:mb-4 flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 w-full sm:w-auto"
        >
          {showForm ? (
            <>
              <ChevronUp className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Hide Form
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Add New {activeTab === 'hotels' ? 'Hotel' : 'Collaborator'}
            </>
          )}
        </button>

        {/* Collapsible Form */}
        {showForm && (
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Add New {activeTab === 'hotels' ? 'Hotel' : 'Collaborator'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full p-2 border rounded text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  className="mt-1 w-full p-2 border rounded text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  required
                  className="mt-1 w-full p-2 border rounded text-sm"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Commission Rate (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  className="mt-1 w-full p-2 border rounded text-sm"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Contact Person</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full p-2 border rounded text-sm"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full p-2 border rounded text-sm"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  className="mt-1 w-full p-2 border rounded text-sm"
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center text-sm"
                >
                  <PlusCircle className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Add {activeTab === 'hotels' ? 'Hotel' : 'Collaborator'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Partners List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
              {activeTab === 'hotels' ? 'Hotels' : 'Collaborators'} List
            </h3>
            
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : partners.length === 0 ? (
              <p className="text-gray-500 text-center py-6 sm:py-8">
                No {activeTab === 'hotels' ? 'hotels' : 'collaborators'} found
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {partners.map((partner) => (
                      <tr key={partner.id}>
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                          {editingId === partner.id ? (
                            <input
                              type="text"
                              className="w-full p-1 border rounded text-sm"
                              value={editFormData.name}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                            />
                          ) : (
                            <div>
                              <div className="font-medium text-sm">{partner.name}</div>
                              <div className="text-xs text-gray-500">{partner.address}</div>
                              {/* Show contact info on mobile */}
                              <div className="text-xs text-gray-500 sm:hidden mt-1">
                                <div>{partner.contactPerson}</div>
                                <div>{partner.email}</div>
                                <div>{partner.phone}</div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 hidden sm:table-cell">
                          {editingId === partner.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                className="w-full p-1 border rounded text-sm"
                                value={editFormData.contactPerson}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                                placeholder="Contact Person"
                              />
                              <input
                                type="email"
                                className="w-full p-1 border rounded text-sm"
                                value={editFormData.email}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm">{partner.contactPerson}</div>
                              <div className="text-xs text-gray-500">{partner.email}</div>
                              <div className="text-xs text-gray-500">{partner.phone}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                          {editingId === partner.id ? (
                            <input
                              type="number"
                              className="w-20 p-1 border rounded text-sm"
                              value={editFormData.commissionRate}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                            />
                          ) : (
                            <div className="text-sm">
                              {partner.commissionRate}%
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 space-x-1 sm:space-x-2">
                          {editingId === partner.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(partner.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Save className="h-4 w-4 sm:h-5 sm:w-5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="h-4 w-4 sm:h-5 sm:w-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(partner)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(partner.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                              </button>
                              <button
                                onClick={() => loadPartnerHistory(partner.id, partner.name)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <History className="h-4 w-4 sm:h-5 sm:w-5" />
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
