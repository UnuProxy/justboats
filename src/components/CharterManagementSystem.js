import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Check, X, DollarSign, Calendar, Phone, Mail, 
  Clock, TrendingUp, Users, Award, CheckCircle2,
  Building, AlertTriangle, CreditCard, Banknote,
  MessageSquare, Filter, Search, UserPlus, Star, Eye,
  Anchor, MapPin, Menu, Edit3
} from 'lucide-react';

const AgencyCRM = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [agencyBookings, setAgencyBookings] = useState([]);
  const [boats, setBoats] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [showLeadDetails, setShowLeadDetails] = useState(null);
  const [showBookingDetails, setShowBookingDetails] = useState(null);
  const [showEditBooking, setShowEditBooking] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(null);
  const [showAssignLead, setShowAssignLead] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if user is an agent
  const isAgent = () => user?.role === 'agent';
  const userAgencyName = user?.agencyName || 'Unknown Agency';
  const userCommissionRate = user?.commissionRate || 15;

  // Form states
  const [leadForm, setLeadForm] = useState({
    customerName: '',
    email: '',
    phone: '',
    source: 'website',
    budget: '',
    preferredDate: '',
    duration: '',
    guests: '',
    notes: '',
    priority: 'medium'
  });

  const [bookingForm, setBookingForm] = useState({
    customerName: '',
    email: '',
    phone: '',
    preferredDate: '',
    duration: '',
    guests: '',
    estimatedAmount: '',
    boatId: '',
    boatName: '',
    startTime: '',
    endTime: '',
    location: '',
    services: [],
    specialRequests: '',
    notes: '',
    priority: 'medium',
    leadId: ''
  });

  // Available services
  const availableServices = [
    'Captain & Crew',
    'Catering',
    'DJ/Music',
    'Water Sports',
    'Photography',
    'Decoration',
    'Bar Service',
    'Transportation'
  ];

  // Real-time listeners
  useEffect(() => {
    if (!user) return;

    const leadsQuery = isAdmin() 
      ? query(collection(db, 'agency_leads'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'agency_leads'), where('agentId', '==', user.uid), orderBy('createdAt', 'desc'));
    
    const bookingsQuery = isAdmin()
      ? query(collection(db, 'agent_bookings'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'agent_bookings'), where('agentId', '==', user.uid), orderBy('createdAt', 'desc'));

    // Load boats for booking selection
    const boatsQuery = query(collection(db, 'boats'), orderBy('name'));

    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      setLeads(leadsData);
      setLoading(false);
    });

    const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      setAgencyBookings(bookingsData);
    });

    const unsubscribeBoats = onSnapshot(boatsQuery, (snapshot) => {
      const boatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBoats(boatsData);
    });

    let unsubscribeAgents;
    if (isAdmin()) {
      const agentsQuery = query(collection(db, 'users'), where('role', '==', 'agent'));
      unsubscribeAgents = onSnapshot(agentsQuery, (snapshot) => {
        const agentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAgents(agentsData);
      });
    }

    return () => {
      unsubscribeLeads();
      unsubscribeBookings();
      unsubscribeBoats();
      if (unsubscribeAgents) unsubscribeAgents();
    };
  }, [user, isAdmin]);

  // Calculate lead score
  const calculateLeadScore = (lead) => {
    let score = 0;
    const budget = parseFloat(lead.budget) || 0;
    const guests = parseInt(lead.guests) || 0;
    
    if (budget > 2000) score += 30;
    else if (budget > 1000) score += 20;
    else if (budget > 500) score += 10;
    
    if (guests >= 8) score += 20;
    else if (guests >= 4) score += 10;
    
    if (lead.preferredDate) score += 15;
    if (lead.priority === 'high') score += 25;
    else if (lead.priority === 'medium') score += 10;
    
    return Math.min(score, 100);
  };

  // Update lead status
  const updateLeadStatus = async (leadId, newStatus, note = '') => {
    try {
      await updateDoc(doc(db, 'agency_leads', leadId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      if (note) {
        await addDoc(collection(db, 'agency_activities'), {
          leadId,
          agentId: user.uid,
          agentName: user.displayName || user.email,
          type: 'note_added',
          description: note,
          createdAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'agency_activities'), {
        leadId,
        agentId: user.uid,
        agentName: user.displayName || user.email,
        type: 'status_changed',
        description: `Status changed to ${newStatus}`,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  // Edit booking
  const editAgentBooking = async () => {
    if (!showEditBooking) return;

    try {
      const selectedBoat = boats.find(b => b.id === bookingForm.boatId);
      
      const updateData = {
        customerName: bookingForm.customerName || '',
        email: bookingForm.email || '',
        phone: bookingForm.phone || '',
        preferredDate: bookingForm.preferredDate || '',
        duration: bookingForm.duration || '',
        guests: parseInt(bookingForm.guests) || 0,
        estimatedAmount: parseFloat(bookingForm.estimatedAmount) || 0,
        boatId: bookingForm.boatId || '',
        boatName: bookingForm.boatName || '',
        startTime: bookingForm.startTime || '',
        endTime: bookingForm.endTime || '',
        location: bookingForm.location || '',
        services: bookingForm.services || [],
        specialRequests: bookingForm.specialRequests || '',
        notes: bookingForm.notes || '',
        priority: bookingForm.priority || 'medium',
        updatedAt: serverTimestamp()
      };

      // Only update boatDetails if we have a selected boat
      if (selectedBoat && selectedBoat.name && selectedBoat.type) {
        updateData.boatDetails = {
          name: selectedBoat.name || '',
          type: selectedBoat.type || '',
          capacity: selectedBoat.capacity || 0,
          pricePerHour: selectedBoat.pricePerHour || 0
        };
      }

      await updateDoc(doc(db, 'agent_bookings', showEditBooking.id), updateData);

      setShowEditBooking(null);
      setBookingForm({
        customerName: '',
        email: '',
        phone: '',
        preferredDate: '',
        duration: '',
        guests: '',
        estimatedAmount: '',
        boatId: '',
        boatName: '',
        startTime: '',
        endTime: '',
        location: '',
        services: [],
        specialRequests: '',
        notes: '',
        priority: 'medium',
        leadId: ''
      });
      
      alert('Agent booking updated successfully!');
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error updating booking: ' + error.message);
    }
  };

  // Edit booking function
  const startEditBooking = (booking) => {
    setBookingForm({
      customerName: booking.customerName || '',
      email: booking.email || '',
      phone: booking.phone || '',
      preferredDate: booking.preferredDate || '',
      duration: booking.duration || '',
      guests: booking.guests ? booking.guests.toString() : '',
      estimatedAmount: booking.estimatedAmount ? booking.estimatedAmount.toString() : '',
      boatId: booking.boatId || '',
      boatName: booking.boatName || '',
      startTime: booking.startTime || '',
      endTime: booking.endTime || '',
      location: booking.location || '',
      services: booking.services || [],
      specialRequests: booking.specialRequests || '',
      notes: booking.notes || '',
      priority: booking.priority || 'medium',
      leadId: booking.linkedLeadId || ''
    });
    setShowEditBooking(booking);
  };

  // Set commission (Admin only)
  const setBookingCommission = async (bookingId, finalAmount, commissionRate) => {
    if (!isAdmin()) return;
    
    try {
      const commission = (finalAmount * commissionRate) / 100;
      await updateDoc(doc(db, 'agent_bookings', bookingId), {
        finalAmount: parseFloat(finalAmount),
        commissionRate: parseFloat(commissionRate),
        commission,
        commissionStatus: 'pending',
        status: 'confirmed',
        updatedAt: serverTimestamp()
      });
      setShowCommissionModal(null);
      alert('Commission set successfully!');
    } catch (error) {
      console.error('Error setting commission:', error);
      alert('Error setting commission: ' + error.message);
    }
  };

  // Add booking note
  const addBookingNote = async (bookingId, note) => {
    try {
      await addDoc(collection(db, 'agency_activities'), {
        bookingId,
        agentId: user.uid,
        agentName: user.displayName || user.email,
        type: 'booking_note',
        description: note,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  // Assign lead
  const assignLead = async (leadId, agentId, agentName) => {
    if (!isAdmin()) return;
    
    try {
      await updateDoc(doc(db, 'agency_leads', leadId), {
        assignedTo: agentId,
        assignedToName: agentName,
        status: 'assigned',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'agency_activities'), {
        leadId,
        agentId: user.uid,
        agentName: user.displayName || user.email,
        type: 'lead_assigned',
        description: `Lead assigned to ${agentName}`,
        createdAt: serverTimestamp()
      });

      setShowAssignLead(null);
    } catch (error) {
      console.error('Error assigning lead:', error);
    }
  };

  // Convert lead to booking
  const convertLeadToBooking = (lead) => {
    setBookingForm({
      customerName: lead.customerName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      preferredDate: lead.preferredDate || '',
      duration: lead.duration || '',
      guests: lead.guests ? lead.guests.toString() : '',
      estimatedAmount: lead.budget ? lead.budget.toString() : '',
      boatId: '',
      boatName: '',
      startTime: '',
      endTime: '',
      location: '',
      services: [],
      specialRequests: '',
      notes: lead.notes || '',
      priority: lead.priority || 'medium',
      leadId: lead.id || ''
    });
    setShowAddBooking(true);
  };

  // Add lead
  const addLead = async () => {
    try {
      const agentName = user.displayName || user.email;
      const leadData = {
        ...leadForm,
        guests: parseInt(leadForm.guests) || 0,
        budget: parseFloat(leadForm.budget) || 0,
        status: 'new',
        agentId: user.uid,
        agentName,
        agencyName: isAgent() ? userAgencyName : 'Direct',
        commissionRate: isAgent() ? userCommissionRate : 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        score: calculateLeadScore(leadForm)
      };

      const leadRef = await addDoc(collection(db, 'agency_leads'), leadData);

      await addDoc(collection(db, 'agency_activities'), {
        leadId: leadRef.id,
        agentId: user.uid,
        agentName,
        type: 'lead_created',
        description: `New lead created: ${leadForm.customerName}`,
        createdAt: serverTimestamp()
      });

      setLeadForm({
        customerName: '',
        email: '',
        phone: '',
        source: 'website',
        budget: '',
        preferredDate: '',
        duration: '',
        guests: '',
        notes: '',
        priority: 'medium'
      });
      setShowAddLead(false);
    } catch (error) {
      console.error('Error adding lead:', error);
      alert('Error adding lead. Please try again.');
    }
  };

  // Add booking
  const addAgencyBooking = async () => {
    if (!isAgent() && !isAdmin()) {
      alert('Only agents and admins can submit bookings');
      return;
    }

    if (!bookingForm.customerName || !bookingForm.email || !bookingForm.phone || !bookingForm.estimatedAmount) {
      alert('Please fill in all required fields (Customer Name, Email, Phone, and Estimated Amount)');
      return;
    }

    try {
      const agentName = user.displayName || user.email;
      const selectedBoat = boats.find(b => b.id === bookingForm.boatId);
      
      // Clean the booking data to remove any undefined values
      const cleanBookingData = {
        customerName: bookingForm.customerName || '',
        email: bookingForm.email || '',
        phone: bookingForm.phone || '',
        preferredDate: bookingForm.preferredDate || '',
        duration: bookingForm.duration || '',
        guests: parseInt(bookingForm.guests) || 0,
        estimatedAmount: parseFloat(bookingForm.estimatedAmount) || 0,
        boatId: bookingForm.boatId || '',
        boatName: bookingForm.boatName || '',
        startTime: bookingForm.startTime || '',
        endTime: bookingForm.endTime || '',
        location: bookingForm.location || '',
        services: bookingForm.services || [],
        specialRequests: bookingForm.specialRequests || '',
        notes: bookingForm.notes || '',
        priority: bookingForm.priority || 'medium',
        leadId: bookingForm.leadId || '',
        finalAmount: 0,
        commission: 0,
        commissionRate: userCommissionRate || 15,
        status: 'pending_approval',
        paymentStatus: 'pending',
        commissionStatus: 'pending',
        agentId: user.uid,
        agentName,
        agencyName: isAgent() ? userAgencyName : 'Direct',
        bookingType: 'agency',
        source: 'agency_partner',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Only add boatDetails if we have a selected boat with all required fields
      if (selectedBoat && selectedBoat.name && selectedBoat.type) {
        cleanBookingData.boatDetails = {
          name: selectedBoat.name || '',
          type: selectedBoat.type || '',
          capacity: selectedBoat.capacity || 0,
          pricePerHour: selectedBoat.pricePerHour || 0
        };
      }

      // Only add linkedLeadId if we have a valid leadId
      if (bookingForm.leadId) {
        cleanBookingData.linkedLeadId = bookingForm.leadId;
      }

      await addDoc(collection(db, 'agent_bookings'), cleanBookingData);

      if (bookingForm.leadId) {
        await updateDoc(doc(db, 'agency_leads', bookingForm.leadId), {
          status: 'converted',
          convertedToBooking: true,
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'agency_activities'), {
          leadId: bookingForm.leadId,
          agentId: user.uid,
          agentName,
          type: 'lead_converted',
          description: `Lead converted to booking: ${bookingForm.customerName}`,
          createdAt: serverTimestamp()
        });
      }

      // Reset form
      setBookingForm({
        customerName: '',
        email: '',
        phone: '',
        preferredDate: '',
        duration: '',
        guests: '',
        estimatedAmount: '',
        boatId: '',
        boatName: '',
        startTime: '',
        endTime: '',
        location: '',
        services: [],
        specialRequests: '',
        notes: '',
        priority: 'medium',
        leadId: ''
      });
      setShowAddBooking(false);
      
      alert('Agent booking submitted successfully!');
    } catch (error) {
      console.error('Error adding booking:', error);
      alert('Error adding agent booking: ' + error.message);
    }
  };



  // Update commission payment
  const updateCommissionPayment = async (bookingId, paymentStatus, commissionStatus) => {
    if (!isAdmin()) return;
    
    try {
      await updateDoc(doc(db, 'agent_bookings', bookingId), {
        paymentStatus,
        commissionStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  // Reject booking
  const rejectBooking = async (bookingId) => {
    if (!isAdmin()) return;
    
    try {
      await updateDoc(doc(db, 'agent_bookings', bookingId), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error rejecting booking:', error);
    }
  };

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  // Filter bookings
  const filteredBookings = agencyBookings.filter(booking => {
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.boatName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Status colors
  const getStatusColor = (status) => {
    switch(status) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'contacted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'assigned': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'qualified': return 'bg-green-100 text-green-800 border-green-200';
      case 'converted': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'pending_approval': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'lost': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'received': return 'bg-green-100 text-green-800 border-green-200';
      case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'not_set': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin() && !isAgent()) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">You need to be an admin or agent to access this system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Mobile-Friendly Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Building className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {isAdmin() ? 'Agency Hub' : userAgencyName}
            </h1>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-lg bg-white shadow-md"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <p className="text-gray-600 text-sm sm:text-lg">
          {isAdmin() 
            ? 'Manage agency partnerships & track commissions' 
            : 'Submit leads and bookings for approval'
          }
        </p>
        {isAgent() && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-blue-800 text-sm">
              <strong>Commission:</strong> {userCommissionRate}% • 
              <strong>Agency:</strong> {userAgencyName}
            </p>
          </div>
        )}
      </div>

      {/* Edit Agent Booking Modal */}
      {showEditBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900">
                Edit Agent Booking
              </h3>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <p className="text-orange-800 text-sm">
                  <strong>Editing:</strong> Changes will be saved to the existing booking.
                </p>
              </div>

              {/* Customer Information */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input
                    value={bookingForm.customerName}
                    onChange={(e) => setBookingForm({...bookingForm, customerName: e.target.value})}
                    placeholder="Customer Name *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    value={bookingForm.email}
                    onChange={(e) => setBookingForm({...bookingForm, email: e.target.value})}
                    type="email"
                    placeholder="Email *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({...bookingForm, phone: e.target.value})}
                    placeholder="Phone *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Boat & Timing */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Boat & Timing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <select
                    value={bookingForm.boatId}
                    onChange={(e) => {
                      const selectedBoat = boats.find(b => b.id === e.target.value);
                      setBookingForm({
                        ...bookingForm, 
                        boatId: e.target.value,
                        boatName: selectedBoat?.name || ''
                      });
                    }}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Boat</option>
                    {boats.map(boat => (
                      <option key={boat.id} value={boat.id}>
                        {boat.name} - {boat.type} (€{boat.pricePerHour}/hr)
                      </option>
                    ))}
                  </select>
                  
                  <input
                    value={bookingForm.preferredDate}
                    onChange={(e) => setBookingForm({...bookingForm, preferredDate: e.target.value})}
                    type="date"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.guests}
                    onChange={(e) => setBookingForm({...bookingForm, guests: e.target.value})}
                    type="number"
                    placeholder="Number of Guests"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.startTime}
                    onChange={(e) => setBookingForm({...bookingForm, startTime: e.target.value})}
                    type="time"
                    placeholder="Start Time"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.endTime}
                    onChange={(e) => setBookingForm({...bookingForm, endTime: e.target.value})}
                    type="time"
                    placeholder="End Time"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.location}
                    onChange={(e) => setBookingForm({...bookingForm, location: e.target.value})}
                    placeholder="Departure Location"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Services & Pricing */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Services & Pricing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <input
                    value={bookingForm.estimatedAmount}
                    onChange={(e) => setBookingForm({...bookingForm, estimatedAmount: e.target.value})}
                    type="number"
                    placeholder="Estimated Total Amount (€) *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <select
                    value={bookingForm.priority}
                    onChange={(e) => setBookingForm({...bookingForm, priority: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                {/* Services Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Services</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableServices.map(service => (
                      <label key={service} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={bookingForm.services.includes(service)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBookingForm({
                                ...bookingForm,
                                services: [...bookingForm.services, service]
                              });
                            } else {
                              setBookingForm({
                                ...bookingForm,
                                services: bookingForm.services.filter(s => s !== service)
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{service}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes & Special Requests */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Notes & Special Requests</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm({...bookingForm, notes: e.target.value})}
                    placeholder="General notes about the agent booking..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="4"
                  />
                  <textarea
                    value={bookingForm.specialRequests}
                    onChange={(e) => setBookingForm({...bookingForm, specialRequests: e.target.value})}
                    placeholder="Special requests from customer..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="4"
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={editAgentBooking}
                  className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg hover:from-orange-700 hover:to-red-700 flex-1 font-medium"
                >
                  Update Booking
                </button>
                <button
                  onClick={() => {
                    setShowEditBooking(null);
                    setBookingForm({
                      customerName: '',
                      email: '',
                      phone: '',
                      preferredDate: '',
                      duration: '',
                      guests: '',
                      estimatedAmount: '',
                      boatId: '',
                      boatName: '',
                      startTime: '',
                      endTime: '',
                      location: '',
                      services: [],
                      specialRequests: '',
                      notes: '',
                      priority: 'medium',
                      leadId: ''
                    });
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 flex-1 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commission Setting Modal (Admin Only) */}
      {showCommissionModal && isAdmin() && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Set Commission</h3>
              <p className="text-gray-600 mb-4">Set final amount and commission for: {showCommissionModal.customerName}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Final Amount (€)</label>
                  <input
                    type="number"
                    id="finalAmount"
                    placeholder={showCommissionModal.estimatedAmount || '0'}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                  <input
                    type="number"
                    id="commissionRate"
                    defaultValue={showCommissionModal.commissionRate || 15}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    const finalAmount = document.getElementById('finalAmount').value;
                    const commissionRate = document.getElementById('commissionRate').value;
                    if (finalAmount && commissionRate) {
                      setBookingCommission(showCommissionModal.id, finalAmount, commissionRate);
                    } else {
                      alert('Please enter both final amount and commission rate');
                    }
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex-1 font-medium"
                >
                  Set Commission
                </button>
                <button
                  onClick={() => setShowCommissionModal(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 flex-1 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Add Booking Modal */}
      {showAddBooking && (isAgent() || isAdmin()) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900">
                {bookingForm.leadId ? 'Convert Lead to Agent Booking' : 'Create New Agent Booking'}
              </h3>
              
              {bookingForm.leadId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-green-800 text-sm">
                    <strong>Converting Lead:</strong> This agent booking will be linked to the lead and the lead status will be updated to Converted.
                  </p>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-blue-800 text-sm">
                  <strong>Agency:</strong> {userAgencyName} • 
                  <strong>Commission Rate:</strong> {userCommissionRate}%
                </p>
              </div>

              {/* Customer Information */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input
                    value={bookingForm.customerName}
                    onChange={(e) => setBookingForm({...bookingForm, customerName: e.target.value})}
                    placeholder="Customer Name *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    value={bookingForm.email}
                    onChange={(e) => setBookingForm({...bookingForm, email: e.target.value})}
                    type="email"
                    placeholder="Email *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({...bookingForm, phone: e.target.value})}
                    placeholder="Phone *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Boat & Timing */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Boat & Timing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <select
                    value={bookingForm.boatId}
                    onChange={(e) => {
                      const selectedBoat = boats.find(b => b.id === e.target.value);
                      setBookingForm({
                        ...bookingForm, 
                        boatId: e.target.value,
                        boatName: selectedBoat?.name || ''
                      });
                    }}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Boat *</option>
                    {boats.map(boat => (
                      <option key={boat.id} value={boat.id}>
                        {boat.name} - {boat.type} (€{boat.pricePerHour}/hr)
                      </option>
                    ))}
                  </select>
                  
                  <input
                    value={bookingForm.preferredDate}
                    onChange={(e) => setBookingForm({...bookingForm, preferredDate: e.target.value})}
                    type="date"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.guests}
                    onChange={(e) => setBookingForm({...bookingForm, guests: e.target.value})}
                    type="number"
                    placeholder="Number of Guests"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.startTime}
                    onChange={(e) => setBookingForm({...bookingForm, startTime: e.target.value})}
                    type="time"
                    placeholder="Start Time"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.endTime}
                    onChange={(e) => setBookingForm({...bookingForm, endTime: e.target.value})}
                    type="time"
                    placeholder="End Time"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    value={bookingForm.location}
                    onChange={(e) => setBookingForm({...bookingForm, location: e.target.value})}
                    placeholder="Departure Location"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Services & Pricing */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Services & Pricing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <input
                    value={bookingForm.estimatedAmount}
                    onChange={(e) => setBookingForm({...bookingForm, estimatedAmount: e.target.value})}
                    type="number"
                    placeholder="Estimated Total Amount (€) *"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <select
                    value={bookingForm.priority}
                    onChange={(e) => setBookingForm({...bookingForm, priority: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                {/* Services Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Services</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableServices.map(service => (
                      <label key={service} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={bookingForm.services.includes(service)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBookingForm({
                                ...bookingForm,
                                services: [...bookingForm.services, service]
                              });
                            } else {
                              setBookingForm({
                                ...bookingForm,
                                services: bookingForm.services.filter(s => s !== service)
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{service}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes & Special Requests */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Notes & Special Requests</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm({...bookingForm, notes: e.target.value})}
                    placeholder="General notes about the agent booking..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="4"
                  />
                  <textarea
                    value={bookingForm.specialRequests}
                    onChange={(e) => setBookingForm({...bookingForm, specialRequests: e.target.value})}
                    placeholder="Special requests from customer..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="4"
                  />
                </div>
              </div>

              {/* Commission Preview */}
              {bookingForm.estimatedAmount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-green-800 font-medium">Estimated Commission:</span>
                    <span className="text-green-600 font-bold text-lg">
                      €{((parseFloat(bookingForm.estimatedAmount) || 0) * userCommissionRate / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={addAgencyBooking}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-blue-700 flex-1 font-medium"
                >
                  {bookingForm.leadId ? 'Convert & Submit Agent Booking' : 'Submit Agent Booking'}
                </button>
                <button
                  onClick={() => {
                    setShowAddBooking(false);
                    setBookingForm({
                      customerName: '',
                      email: '',
                      phone: '',
                      preferredDate: '',
                      duration: '',
                      guests: '',
                      estimatedAmount: '',
                      boatId: '',
                      boatName: '',
                      startTime: '',
                      endTime: '',
                      location: '',
                      services: [],
                      specialRequests: '',
                      notes: '',
                      priority: 'medium',
                      leadId: ''
                    });
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 flex-1 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {showBookingDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{showBookingDetails.customerName}</h3>
                  <p className="text-gray-600">{showBookingDetails.email} • {showBookingDetails.phone}</p>
                </div>
                <button
                  onClick={() => setShowBookingDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Status & Priority */}
              <div className="flex flex-wrap gap-3 mb-6">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(showBookingDetails.status)}`}>
                  {showBookingDetails.status.replace('_', ' ')}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(showBookingDetails.priority)}`}>
                  {showBookingDetails.priority} priority
                </span>
                {showBookingDetails.linkedLeadId && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    Converted from Lead
                  </span>
                )}
              </div>

              {/* Boat Information */}
              {showBookingDetails.boatDetails && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Anchor className="w-5 h-5" />
                    Boat Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-blue-600 mb-1">Name</p>
                      <p className="font-semibold text-blue-800">{showBookingDetails.boatDetails.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 mb-1">Type</p>
                      <p className="font-semibold text-blue-800">{showBookingDetails.boatDetails.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 mb-1">Capacity</p>
                      <p className="font-semibold text-blue-800">{showBookingDetails.boatDetails.capacity} people</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 mb-1">Rate</p>
                      <p className="font-semibold text-blue-800">€{showBookingDetails.boatDetails.pricePerHour}/hour</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <p className="text-gray-900">{showBookingDetails.preferredDate || 'TBD'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <p className="text-gray-900">
                    {showBookingDetails.startTime && showBookingDetails.endTime 
                      ? `${showBookingDetails.startTime} - ${showBookingDetails.endTime}` 
                      : showBookingDetails.duration || 'TBD'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
                  <p className="text-gray-900">{showBookingDetails.guests}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <p className="text-gray-900">{showBookingDetails.location || 'TBD'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                  <p className="text-lg font-semibold text-gray-900">€{showBookingDetails.finalAmount || showBookingDetails.estimatedAmount || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission ({showBookingDetails.commissionRate}%)</label>
                  <p className="text-lg font-semibold text-green-600">
                    {showBookingDetails.commission ? `€${showBookingDetails.commission.toFixed(2)}` : 'Not Set'}
                  </p>
                </div>
              </div>

              {/* Services */}
              {showBookingDetails.services?.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Services</label>
                  <div className="flex flex-wrap gap-2">
                    {showBookingDetails.services.map((service, index) => (
                      <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {(showBookingDetails.notes || showBookingDetails.specialRequests) && (
                <div className="space-y-4 mb-6">
                  {showBookingDetails.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700">{showBookingDetails.notes}</p>
                      </div>
                    </div>
                  )}
                  {showBookingDetails.specialRequests && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Special Requests</label>
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <p className="text-gray-700">{showBookingDetails.specialRequests}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Agency Info */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-800 mb-2">Agency Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-blue-600 mb-1">Agency</p>
                    <p className="font-semibold text-blue-800">{showBookingDetails.agencyName}</p>
                  </div>
                  <div>
                    <p className="text-blue-600 mb-1">Agent</p>
                    <p className="font-semibold text-blue-800">{showBookingDetails.agentName}</p>
                  </div>
                  <div>
                    <p className="text-blue-600 mb-1">Created</p>
                    <p className="font-semibold text-blue-800">{showBookingDetails.createdAt?.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-800 mb-2">Payment & Commission Status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Booking Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(showBookingDetails.status)}`}>
                      {showBookingDetails.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Payment Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(showBookingDetails.paymentStatus)}`}>
                      {showBookingDetails.paymentStatus}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Commission Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(showBookingDetails.commissionStatus)}`}>
                      {showBookingDetails.commissionStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowBookingDetails(null)}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900">Add New Lead</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input
                  value={leadForm.customerName}
                  onChange={(e) => setLeadForm({...leadForm, customerName: e.target.value})}
                  placeholder="Customer Name *"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <input
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({...leadForm, email: e.target.value})}
                  type="email"
                  placeholder="Email *"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <input
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({...leadForm, phone: e.target.value})}
                  placeholder="Phone *"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <select
                  value={leadForm.source}
                  onChange={(e) => setLeadForm({...leadForm, source: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="social_media">Social Media</option>
                  <option value="phone_call">Phone Call</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="other">Other</option>
                </select>
                <input
                  value={leadForm.budget}
                  onChange={(e) => setLeadForm({...leadForm, budget: e.target.value})}
                  type="number"
                  placeholder="Budget (€)"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  value={leadForm.preferredDate}
                  onChange={(e) => setLeadForm({...leadForm, preferredDate: e.target.value})}
                  type="date"
                  placeholder="Preferred Date"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  value={leadForm.duration}
                  onChange={(e) => setLeadForm({...leadForm, duration: e.target.value})}
                  placeholder="Duration (e.g. 4 hours)"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  value={leadForm.guests}
                  onChange={(e) => setLeadForm({...leadForm, guests: e.target.value})}
                  type="number"
                  placeholder="Number of Guests"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <select
                  value={leadForm.priority}
                  onChange={(e) => setLeadForm({...leadForm, priority: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="mb-6">
                <textarea
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({...leadForm, notes: e.target.value})}
                  placeholder="Notes about the lead..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="3"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={addLead}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 flex-1 font-medium"
                >
                  Add Lead
                </button>
                <button
                  onClick={() => {
                    setShowAddLead(false);
                    setLeadForm({
                      customerName: '',
                      email: '',
                      phone: '',
                      source: 'website',
                      budget: '',
                      preferredDate: '',
                      duration: '',
                      guests: '',
                      notes: '',
                      priority: 'medium'
                    });
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 flex-1 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      {showLeadDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{showLeadDetails.customerName}</h3>
                  <p className="text-gray-600">{showLeadDetails.email} • {showLeadDetails.phone}</p>
                </div>
                <button
                  onClick={() => setShowLeadDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(showLeadDetails.status)}`}>
                    {showLeadDetails.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(showLeadDetails.priority)}`}>
                    {showLeadDetails.priority}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold">{showLeadDetails.score || calculateLeadScore(showLeadDetails)}/100</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                  <p className="text-lg font-semibold text-gray-900">€{showLeadDetails.budget}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
                  <p className="text-gray-900">{showLeadDetails.preferredDate || 'Flexible'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <p className="text-gray-900">{showLeadDetails.duration || 'TBD'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
                  <p className="text-gray-900">{showLeadDetails.guests}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <p className="text-gray-900">{showLeadDetails.source}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                  <p className="text-gray-900">{showLeadDetails.createdAt?.toLocaleDateString()}</p>
                </div>
              </div>

              {showLeadDetails.notes && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{showLeadDetails.notes}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {isAgent() && (
                  <button
                    onClick={() => {
                      convertLeadToBooking(showLeadDetails);
                      setShowLeadDetails(null);
                    }}
                    className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-blue-700 flex-1 font-medium"
                  >
                    Convert to Agent Booking
                  </button>
                )}
                <button
                  onClick={() => setShowLeadDetails(null)}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 flex-1 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Assignment Modal (Admin Only) */}
      {showAssignLead && isAdmin() && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Assign Lead</h3>
              <p className="text-gray-600 mb-4">Assign {showAssignLead.customerName} to an agent:</p>
              
              <div className="space-y-2 mb-6">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => assignLead(showAssignLead.id, agent.id, agent.displayName || agent.email)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium">{agent.displayName || agent.email}</div>
                    <div className="text-sm text-gray-600">{agent.agencyName}</div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowAssignLead(null)}
                className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-Friendly Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-blue-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Leads</p>
              <p className="text-xl sm:text-3xl font-bold text-blue-600">{leads.length}</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 rounded-full mt-2 sm:mt-0 w-fit">
              <Users className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-green-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Active Bookings</p>
              <p className="text-xl sm:text-3xl font-bold text-green-600">
                {agencyBookings.filter(b => ['pending_approval', 'confirmed'].includes(b.status)).length}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 rounded-full mt-2 sm:mt-0 w-fit">
              <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-purple-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Confirmed</p>
              <p className="text-xl sm:text-3xl font-bold text-purple-600">
                {agencyBookings.filter(b => b.status === 'confirmed').length}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-100 rounded-full mt-2 sm:mt-0 w-fit">
              <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-emerald-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Commission</p>
              <p className="text-xl sm:text-3xl font-bold text-emerald-600">
                €{agencyBookings.filter(b => b.commissionStatus === 'pending' && b.commission).reduce((sum, b) => sum + b.commission, 0).toFixed(0)}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-emerald-100 rounded-full mt-2 sm:mt-0 w-fit">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-Friendly Tab Navigation */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} sm:block mb-6`}>
        <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 bg-white rounded-xl p-1 shadow-lg border">
          <button
            onClick={() => {
              setActiveTab('leads');
              setMobileMenuOpen(false);
            }}
            className={`px-4 sm:px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'leads' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Leads ({leads.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('bookings');
              setMobileMenuOpen(false);
            }}
            className={`px-4 sm:px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'bookings' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Bookings ({agencyBookings.length})
          </button>
          {isAdmin() && (
            <button
              onClick={() => {
                setActiveTab('analytics');
                setMobileMenuOpen(false);
              }}
              className={`px-4 sm:px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'analytics' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Analytics
            </button>
          )}
        </div>
      </div>

      {/* Leads Tab */}
      {activeTab === 'leads' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Leads Pipeline</h2>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                />
              </div>
              
              <div className="relative">
                <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white w-full"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="assigned">Assigned</option>
                  <option value="qualified">Qualified</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              
              <button
                onClick={() => setShowAddLead(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 font-medium shadow-lg whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Add Lead
              </button>
            </div>
          </div>

          {/* Mobile-Friendly Lead Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
              <p className="text-xs text-gray-600">Total</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{leads.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
              <p className="text-xs text-gray-600">New</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{leads.filter(l => l.status === 'new').length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
              <p className="text-xs text-gray-600">Qualified</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{leads.filter(l => l.status === 'qualified').length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
              <p className="text-xs text-gray-600">Converted</p>
              <p className="text-lg sm:text-2xl font-bold text-emerald-600">{leads.filter(l => l.status === 'converted').length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4 col-span-3 sm:col-span-1">
              <p className="text-xs text-gray-600">Rate</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">
                {leads.length > 0 ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6">
            {filteredLeads.map(lead => (
              <div key={lead.id} className="bg-white rounded-xl shadow-lg border hover:shadow-xl transition-all duration-200">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">{lead.customerName}</h3>
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getStatusColor(lead.status)}`}>
                            {lead.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(lead.priority)}`}>
                            {lead.priority}
                          </span>
                          {lead.score && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />
                              <span className="text-xs sm:text-sm font-medium text-yellow-600">{lead.score}/100</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">{lead.email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">{lead.phone}</span>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        <Building className="w-4 h-4 inline mr-1" />
                        {lead.agencyName} • {lead.agentName} • {lead.createdAt.toLocaleDateString()}
                        {lead.assignedToName && (
                          <span className="text-purple-600 font-medium"> • Assigned to {lead.assignedToName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Budget</p>
                      <p className="font-semibold text-gray-900">€{lead.budget}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Date</p>
                      <p className="font-semibold text-gray-900">{lead.preferredDate || 'Flexible'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Duration</p>
                      <p className="font-semibold text-gray-900">{lead.duration || 'TBD'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Guests</p>
                      <p className="font-semibold text-gray-900">{lead.guests}</p>
                    </div>
                  </div>

                  {lead.notes && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">Notes:</p>
                      <p className="text-gray-700 bg-gray-50 rounded-lg p-3 text-sm">{lead.notes}</p>
                    </div>
                  )}

                  {/* Mobile-Friendly Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {(isAgent() || isAdmin()) && (
                      <>
                        <button
                          onClick={() => {
                            convertLeadToBooking(lead);
                          }}
                          className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-green-700 hover:to-blue-700 flex items-center gap-2 text-xs sm:text-sm font-medium"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Convert to Agent Booking</span>
                          <span className="sm:hidden">Convert</span>
                        </button>
                        
                        <button
                          onClick={() => setShowLeadDetails(lead)}
                          className="bg-gray-100 text-gray-700 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-xs sm:text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">View Details</span>
                          <span className="sm:hidden">View</span>
                        </button>

                        {lead.status !== 'converted' && lead.status !== 'lost' && (
                          <>
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'contacted')}
                              className="bg-yellow-100 text-yellow-700 px-3 py-2 rounded-lg hover:bg-yellow-200 flex items-center gap-2 text-xs font-medium"
                            >
                              <Phone className="w-4 h-4" />
                              <span className="hidden sm:inline">Contacted</span>
                            </button>
                            
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'qualified')}
                              className="bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-200 flex items-center gap-2 text-xs font-medium"
                            >
                              <Check className="w-4 h-4" />
                              <span className="hidden sm:inline">Qualified</span>
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {isAdmin() && (
                      <button
                        onClick={() => setShowAssignLead(lead)}
                        className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 flex items-center gap-2 text-xs font-medium"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Assign</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredLeads.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg border">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No leads found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filter criteria.' 
                    : 'Start by adding your first lead.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Agent Bookings</h2>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search agent bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                />
              </div>
              
              {(isAgent() || isAdmin()) && (
                <button
                  onClick={() => setShowAddBooking(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  New Agent Booking
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6">
            {filteredBookings.map(booking => (
              <div key={booking.id} className="bg-white rounded-xl shadow-lg border">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">{booking.customerName}</h3>
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getStatusColor(booking.status)}`}>
                            {booking.status.replace('_', ' ')}
                          </span>
                          {booking.linkedLeadId && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              From Lead
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-gray-600 mb-2">
                        <span className="text-sm">{booking.email} • {booking.phone}</span>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        <Building className="w-4 h-4 inline mr-1" />
                        {booking.agencyName} • {booking.agentName} • {booking.createdAt?.toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Boat Details */}
                  {booking.boatDetails && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Anchor className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-blue-800">{booking.boatDetails.name}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-blue-700">
                        <span>Type: {booking.boatDetails.type}</span>
                        <span>Capacity: {booking.boatDetails.capacity}</span>
                        <span>€{booking.boatDetails.pricePerHour}/hr</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Date</p>
                      <p className="font-semibold text-gray-900">{booking.preferredDate || 'TBD'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Time</p>
                      <p className="font-semibold text-gray-900">
                        {booking.startTime && booking.endTime 
                          ? `${booking.startTime}-${booking.endTime}` 
                          : booking.duration || 'TBD'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Amount</p>
                      <p className="font-semibold text-gray-900">€{booking.finalAmount || booking.estimatedAmount || 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Commission ({booking.commissionRate}%)</p>
                      <p className="font-semibold text-green-600">
                        {booking.commission ? `€${booking.commission.toFixed(2)}` : 'Not Set'}
                      </p>
                    </div>
                  </div>

                  {/* Location & Services */}
                  {(booking.location || booking.services?.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {booking.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-700">{booking.location}</span>
                        </div>
                      )}
                      {booking.services?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {booking.services.map((service, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {service}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(booking.notes || booking.specialRequests) && (
                    <div className="mb-4 space-y-2">
                      {booking.notes && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Notes:</p>
                          <p className="text-gray-700 bg-gray-50 rounded-lg p-3 text-sm">{booking.notes}</p>
                        </div>
                      )}
                      {booking.specialRequests && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Special Requests:</p>
                          <p className="text-gray-700 bg-yellow-50 rounded-lg p-3 text-sm">{booking.specialRequests}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin & Agent Actions */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {/* Admin Actions */}
                    {isAdmin() && (
                      <>
                        {booking.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => setShowCommissionModal(booking)}
                              className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm font-medium"
                            >
                              <Check className="w-4 h-4" />
                              Set Commission
                            </button>
                            <button
                              onClick={() => rejectBooking(booking.id)}
                              className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-xs sm:text-sm font-medium"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </>
                        )}
                        
                        {booking.status === 'confirmed' && (
                          <>
                            {booking.paymentStatus === 'pending' && (
                              <button
                                onClick={() => updateCommissionPayment(booking.id, 'received', 'pending')}
                                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs font-medium"
                              >
                                <CreditCard className="w-4 h-4" />
                                Payment ✓
                              </button>
                            )}
                            
                            {booking.paymentStatus === 'received' && booking.commissionStatus === 'pending' && (
                              <button
                                onClick={() => updateCommissionPayment(booking.id, 'received', 'paid')}
                                className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-xs font-medium"
                              >
                                <Banknote className="w-4 h-4" />
                                Commission ✓
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Agent Actions */}
                    {(isAgent() || isAdmin()) && booking.status === 'pending_approval' && (
                      <button
                        onClick={() => startEditBooking(booking)}
                        className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2 text-xs font-medium"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Agent Actions & Status */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBookingDetails(booking)}
                        className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 flex items-center gap-2 text-xs font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </button>
                      
                      <button
                        onClick={() => {
                          const note = prompt('Add a note about this booking:');
                          if (note) addBookingNote(booking.id, note);
                        }}
                        className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-xs font-medium"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Note
                      </button>
                    </div>

                    {/* Status Badge for Agents */}
                    {isAgent() && !isAdmin() && (
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-blue-800 text-xs">
                          <strong>Status:</strong> {booking.status.replace('_', ' ')} • 
                          <strong> Payment:</strong> {booking.paymentStatus} • 
                          <strong> Commission:</strong> {booking.commissionStatus}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredBookings.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg border">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No agent bookings yet</h3>
                <p className="text-gray-600 mb-4">Start by converting leads to bookings or create a new agent booking directly.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab (Admin Only) */}
      {activeTab === 'analytics' && isAdmin() && (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Commissions Paid
              </h3>
              <p className="text-3xl font-bold text-green-600">
                €{agencyBookings.filter(b => b.commissionStatus === 'paid' && b.commission).reduce((sum, b) => sum + b.commission, 0).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {agencyBookings.filter(b => b.commissionStatus === 'paid').length} payments
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6 border border-yellow-100">
              <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Commissions
              </h3>
              <p className="text-3xl font-bold text-yellow-600">
                €{agencyBookings.filter(b => b.commissionStatus === 'pending' && b.paymentStatus === 'received' && b.commission).reduce((sum, b) => sum + b.commission, 0).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {agencyBookings.filter(b => b.commissionStatus === 'pending' && b.paymentStatus === 'received').length} pending
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
              <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Total Revenue
              </h3>
              <p className="text-3xl font-bold text-blue-600">
                €{agencyBookings.filter(b => b.status === 'confirmed' && b.finalAmount).reduce((sum, b) => sum + b.finalAmount, 0).toFixed(0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {agencyBookings.filter(b => b.status === 'confirmed').length} confirmed bookings
              </p>
            </div>
          </div>

          {/* Agent Performance Table */}
          <div className="bg-white rounded-xl shadow-lg p-6 border">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-purple-600" />
              Agent Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700">Agency</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700">Agent</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700">Bookings</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700">Success</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(agent => {
                    const agentBookings = agencyBookings.filter(b => b.agentId === agent.id);
                    const confirmedBookings = agentBookings.filter(b => b.status === 'confirmed');
                    const totalCommissions = agentBookings.filter(b => b.commission).reduce((sum, b) => sum + b.commission, 0);
                    const successRate = agentBookings.length > 0 ? ((confirmedBookings.length / agentBookings.length) * 100).toFixed(1) : 0;

                    return (
                      <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 sm:px-4">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-blue-600" />
                            <span className="truncate">{agent.agencyName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 sm:px-4">
                          <span className="truncate">{agent.displayName || agent.email}</span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 font-medium">{agentBookings.length}</td>
                        <td className="py-3 px-2 sm:px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            successRate >= 80 ? 'bg-green-100 text-green-800' :
                            successRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {successRate}%
                          </span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-green-600 font-medium">€{totalCommissions.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyCRM;