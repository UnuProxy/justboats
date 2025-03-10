import React, { useState, useEffect } from 'react';
import { Ship, Calendar, Clock, Users, Euro, Check, X, ChevronRight, Search, PlusCircle, Percent, Edit, Trash2 } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const SanAntonioBookingsAdmin = () => {
  const [bookings, setBookings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [isExpanded, setIsExpanded] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [partners, setPartners] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [formData, setFormData] = useState({
    clientDetails: {
      name: '',
      phone: '',
      email: ''
    },
    source: {
      type: 'direct', // direct, hotel, collaborator, website
      partnerId: '',
      partnerName: '',
      commission: {
        rate: '',
        amount: '0',
        paid: false,
        paymentDate: ''
      }
    },
    tourType: 'standard',
    tourTime: 'morning',
    date: '',
    startTime: '10:00',
    endTime: '13:30',
    passengers: 4,
    price: 350,
    notes: '',
    payments: {
      deposit: {
        amount: '0',
        method: 'cash',
        received: false,
        date: ''
      },
      remaining: {
        amount: '0',
        method: 'cash',
        received: false,
        date: ''
      },
      status: 'pending', // pending, deposit, paid
      isFullPayment: false
    }
  });
  
  // Tour types and time slots specific to San Antonio
  const tourTypes = [
    { id: 'standard', name: 'Standard Tour', basePrice: 350 },
    { id: 'sunset', name: 'Sunset Cruise', basePrice: 400 },
    { id: 'cala', name: 'Cala Explorer', basePrice: 450 },
    { id: 'full-day', name: 'Full Day Adventure', basePrice: 950 },
    { id: 'custom', name: 'Custom Tour', basePrice: 0 }
  ];
  
  // Specific time slots for San Antonio tours
  const timeSlots = {
    morning: { label: 'Morning (10:00 - 13:30)', start: '10:00', end: '13:30' },
    afternoon: { label: 'Afternoon (14:00 - 17:30)', start: '14:00', end: '17:30' },
    sunset: { label: 'Sunset (18:00 - 21:30)', start: '18:00', end: '21:30' }
  };
  
  // Sources for bookings
  const sourceTypes = [
    { id: 'direct', name: 'Direct Client', hasCommission: false },
    { id: 'hotel', name: 'Hotel Partner', hasCommission: true },
    { id: 'collaborator', name: 'Collaborator', hasCommission: true },
    { id: 'website', name: 'Booking Website', hasCommission: true }
  ];
  
  // Booking websites list
  const bookingWebsites = [
    { id: 'getyourguide', name: 'Get Your Guide', defaultCommission: 20 },
    { id: 'viator', name: 'Viator', defaultCommission: 18 },
    { id: 'tripadvisor', name: 'TripAdvisor', defaultCommission: 15 },
    { id: 'airbnb', name: 'Airbnb Experiences', defaultCommission: 20 },
    { id: 'other', name: 'Other Website', defaultCommission: 15 }
  ];
  
  // Payment methods
  const paymentMethods = ['cash', 'card', 'transfer', 'website'];
  
  useEffect(() => {
    const checkForEditRequest = async () => {
      if (location.state?.editBookingId) {
        const bookingId = location.state.editBookingId;
        setIsLoading(true);
        try {
          // Call your existing handleEdit function with the booking ID
          await handleEdit(bookingId);
        } catch (error) {
          console.error("Error loading booking for edit:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    checkForEditRequest();
  }, [location]);

  // Fetch partners and hotels data
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        // Hotels
        const hotelsSnapshot = await getDocs(collection(db, "hotels"));
        const hotelsData = hotelsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'hotel'
        }));
        setHotels(hotelsData);
        
        // Collaborators
        const collaboratorsSnapshot = await getDocs(collection(db, "collaborators"));
        const collaboratorsData = collaboratorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'collaborator'
        }));
        setPartners(collaboratorsData);
      } catch (error) {
        console.error("Error fetching partners:", error);
      }
    };
    
    fetchPartners();
  }, []);
  
  // Fetch bookings data
  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      // Query for San Antonio bookings only
      const q = query(
        collection(db, "bookings"), 
        where("location", "==", "San Antonio")
      );
      const querySnapshot = await getDocs(q);
      const bookingData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by date (newest first)
      bookingData.sort((a, b) => new Date(b.date || b.bookingDate) - new Date(a.date || a.bookingDate));
      setBookings(bookingData);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchBookings();
  }, []);
  
  // Reset form for new booking
  const resetForm = () => {
    setFormData({
      clientDetails: {
        name: '',
        phone: '',
        email: ''
      },
      source: {
        type: 'direct',
        partnerId: '',
        partnerName: '',
        commission: {
          rate: '',
          amount: '0',
          paid: false,
          paymentDate: ''
        }
      },
      tourType: 'standard',
      tourTime: 'morning',
      date: '',
      startTime: '10:00',
      endTime: '13:30',
      passengers: 4,
      price: 350,
      notes: '',
      payments: {
        deposit: {
          amount: '105',
          method: 'cash',
          received: false,
          date: ''
        },
        remaining: {
          amount: '245',
          method: 'cash',
          received: false,
          date: ''
        },
        status: 'pending',
        isFullPayment: false
      }
    });
    setEditingBookingId(null);
  };
  
  // Add new booking mode
  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };
  
  // Edit existing booking
  const handleEdit = async (bookingId) => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "bookings", bookingId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const booking = docSnap.data();
        
        // Check if it's a full payment case
        const isFullPayment = booking.payments?.isFullPayment || 
          (booking.pricing?.payments && 
           booking.pricing.payments[0]?.amount === booking.pricing?.agreedPrice && 
           booking.pricing.payments[0]?.received);
        
        // Convert from Firebase data structure to form structure
        const mappedData = {
          clientDetails: {
            name: booking.clientDetails?.name || '',
            phone: booking.clientDetails?.phone || '',
            email: booking.clientDetails?.email || ''
          },
          source: {
            type: booking.source?.type || 'direct',
            partnerId: booking.source?.partnerId || '',
            partnerName: booking.source?.partnerName || '',
            commission: {
              rate: booking.source?.commission?.rate?.toString() || '',
              amount: booking.source?.commission?.amount?.toString() || '0',
              paid: booking.source?.commission?.paid || false,
              paymentDate: booking.source?.commission?.paymentDate || ''
            }
          },
          tourType: booking.tourType || 'standard',
          tourTime: booking.tourTime || 'morning',
          date: booking.date || booking.bookingDate || '',
          startTime: booking.bookingDetails?.startTime || '10:00',
          endTime: booking.bookingDetails?.endTime || '13:30',
          passengers: booking.bookingDetails?.passengers || 4,
          price: booking.pricing?.agreedPrice?.toString() || '350',
          notes: booking.notes || '',
          payments: {
            deposit: {
              amount: isFullPayment ? booking.pricing?.agreedPrice?.toString() :
                     (booking.payments?.deposit?.amount?.toString() || 
                     (booking.pricing?.payments && booking.pricing.payments[0] ? 
                      booking.pricing.payments[0].amount?.toString() : '0')),
              method: booking.payments?.deposit?.method || 
                     (booking.pricing?.payments && booking.pricing.payments[0] ? 
                      booking.pricing.payments[0].method : 'cash'),
              received: isFullPayment ? true :
                       (booking.payments?.deposit?.received || 
                       (booking.pricing?.payments && booking.pricing.payments[0] ? 
                        booking.pricing.payments[0].received : false)),
              date: booking.payments?.deposit?.date || 
                   (booking.pricing?.payments && booking.pricing.payments[0] ? 
                    booking.pricing.payments[0].date : '')
            },
            remaining: {
              amount: isFullPayment ? '0' :
                      (booking.payments?.remaining?.amount?.toString() || 
                     (booking.pricing?.payments && booking.pricing.payments[1] ? 
                      booking.pricing.payments[1].amount?.toString() : '0')),
              method: booking.payments?.remaining?.method || 
                     (booking.pricing?.payments && booking.pricing.payments[1] ? 
                      booking.pricing.payments[1].method : 'cash'),
              received: isFullPayment ? false :
                       (booking.payments?.remaining?.received || 
                       (booking.pricing?.payments && booking.pricing.payments[1] ? 
                        booking.pricing.payments[1].received : false)),
              date: booking.payments?.remaining?.date || 
                   (booking.pricing?.payments && booking.pricing.payments[1] ? 
                    booking.pricing.payments[1].date : '')
            },
            status: isFullPayment ? 'paid' : 
                    (booking.pricing?.paymentStatus || 'pending'),
            isFullPayment: isFullPayment
          }
        };
        
        setFormData(mappedData);
        setEditingBookingId(bookingId);
        setShowForm(true);
      } else {
        console.error("No such booking exists!");
        alert("Error: Booking not found.");
      }
    } catch (error) {
      console.error("Error fetching booking:", error);
      alert("Error loading booking details.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle full payment mode
  const handleToggleFullPayment = (isFullPayment) => {
    if (isFullPayment) {
      // Full payment - set deposit to total price, remaining to 0
      setFormData(prev => ({
        ...prev,
        payments: {
          ...prev.payments,
          deposit: {
            ...prev.payments.deposit,
            amount: prev.price,
            received: true,
            date: prev.payments.deposit.date || new Date().toISOString().split('T')[0]
          },
          remaining: {
            ...prev.payments.remaining,
            amount: '0',
            received: false,
            date: ''
          },
          status: 'paid',
          isFullPayment: true
        }
      }));
    } else {
      // Revert to standard 30% deposit
      const depositAmount = Math.round(parseFloat(formData.price) * 0.3);
      const remainingAmount = parseFloat(formData.price) - depositAmount;
      
      setFormData(prev => ({
        ...prev,
        payments: {
          ...prev.payments,
          deposit: {
            ...prev.payments.deposit,
            amount: depositAmount.toString(),
            received: false,
            date: ''
          },
          remaining: {
            ...prev.payments.remaining,
            amount: remainingAmount.toString(),
            received: false,
            date: ''
          },
          status: 'pending',
          isFullPayment: false
        }
      }));
    }
  };
  
  // Delete booking
  const handleDelete = async (bookingId) => {
    if (window.confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
      setIsLoading(true);
      try {
        await deleteDoc(doc(db, "bookings", bookingId));
        // Update local state
        setBookings(prevBookings => prevBookings.filter(booking => booking.id !== bookingId));
        alert("Booking deleted successfully.");
      } catch (error) {
        console.error("Error deleting booking:", error);
        alert("Error deleting booking. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // Handle form input changes
  const handleInputChange = (section, field, value) => {
    if (section === 'tourTime') {
      // Update times based on selected time slot
      const slot = timeSlots[value];
      setFormData(prev => ({
        ...prev,
        tourTime: value,
        startTime: slot.start,
        endTime: slot.end
      }));
      return;
    }
    
    if (section === 'source' && field === 'type') {
      // Reset partner fields when source type changes
      setFormData(prev => ({
        ...prev,
        source: {
          ...prev.source,
          type: value,
          partnerId: '',
          partnerName: '',
          commission: {
            rate: '',
            amount: '0',
            paid: false,
            paymentDate: ''
          }
        }
      }));
      return;
    }
    
    if (section === 'source' && field === 'partnerId') {
      // Handle partner selection based on source type
      if (formData.source.type === 'hotel') {
        const selectedHotel = hotels.find(h => h.id === value);
        setFormData(prev => ({
          ...prev,
          source: {
            ...prev.source,
            partnerId: value,
            partnerName: selectedHotel?.name || '',
            commission: {
              ...prev.source.commission,
              rate: selectedHotel?.commissionRate || '10'
            }
          }
        }));
      } else if (formData.source.type === 'collaborator') {
        const selectedPartner = partners.find(p => p.id === value);
        setFormData(prev => ({
          ...prev,
          source: {
            ...prev.source,
            partnerId: value,
            partnerName: selectedPartner?.name || '',
            commission: {
              ...prev.source.commission,
              rate: selectedPartner?.commissionRate || '15'
            }
          }
        }));
      } else if (formData.source.type === 'website') {
        const selectedWebsite = bookingWebsites.find(w => w.id === value);
        setFormData(prev => ({
          ...prev,
          source: {
            ...prev.source,
            partnerId: value,
            partnerName: selectedWebsite?.name || '',
            commission: {
              ...prev.source.commission,
              rate: selectedWebsite?.defaultCommission.toString() || '15'
            }
          }
        }));
      }
      return;
    }
    
    if (section === 'source' && field === 'commission') {
      // Update commission
      setFormData(prev => ({
        ...prev,
        source: {
          ...prev.source,
          commission: {
            ...prev.source.commission,
            ...value
          }
        }
      }));
      return;
    }
    
    if (section === 'tourType') {
      // Update tour type and price
      const selectedTour = tourTypes.find(t => t.id === value);
      setFormData(prev => ({
        ...prev,
        tourType: value,
        price: selectedTour.basePrice.toString()
      }));
      
      // If selecting sunset tour, automatically set time to sunset
      if (value === 'sunset') {
        const sunsetSlot = timeSlots.sunset;
        setFormData(prev => ({
          ...prev,
          tourTime: 'sunset',
          startTime: sunsetSlot.start,
          endTime: sunsetSlot.end
        }));
      }
      
      // Recalculate deposit amount (30% of total) if not in full payment mode
      if (!formData.payments.isFullPayment) {
        const depositAmount = Math.round(selectedTour.basePrice * 0.3);
        const remainingAmount = selectedTour.basePrice - depositAmount;
        
        setFormData(prev => ({
          ...prev,
          payments: {
            ...prev.payments,
            deposit: {
              ...prev.payments.deposit,
              amount: depositAmount.toString()
            },
            remaining: {
              ...prev.payments.remaining,
              amount: remainingAmount.toString()
            }
          }
        }));
      } else {
        // In full payment mode, deposit is the full price
        setFormData(prev => ({
          ...prev,
          payments: {
            ...prev.payments,
            deposit: {
              ...prev.payments.deposit,
              amount: selectedTour.basePrice.toString()
            },
            remaining: {
              ...prev.payments.remaining,
              amount: '0'
            }
          }
        }));
      }
      
      return;
    }
    
    if (section === 'price') {
      // Update price 
      const price = parseFloat(value) || 0;
      
      if (formData.payments.isFullPayment) {
        // Full payment mode - set deposit to full price
        setFormData(prev => ({
          ...prev,
          price: value,
          payments: {
            ...prev.payments,
            deposit: {
              ...prev.payments.deposit,
              amount: value
            },
            remaining: {
              ...prev.payments.remaining,
              amount: '0'
            }
          }
        }));
      } else {
        // Standard mode - recalculate deposit (30% of total)
        const depositAmount = Math.round(price * 0.3);
        const remainingAmount = price - depositAmount;
        
        setFormData(prev => ({
          ...prev,
          price: value,
          payments: {
            ...prev.payments,
            deposit: {
              ...prev.payments.deposit,
              amount: depositAmount.toString()
            },
            remaining: {
              ...prev.payments.remaining,
              amount: remainingAmount.toString()
            }
          }
        }));
      }
      return;
    }
    
    if (section === 'payments') {
      if (field === 'isFullPayment') {
        // Handle full payment toggle
        handleToggleFullPayment(value);
        return;
      }
      
      if (field === 'status') {
        // Update payment status
        setFormData(prev => ({
          ...prev,
          payments: {
            ...prev.payments,
            status: value
          }
        }));
      } else if (field === 'deposit' || field === 'remaining') {
        // Update deposit or remaining payment details
        setFormData(prev => ({
          ...prev,
          payments: {
            ...prev.payments,
            [field]: {
              ...prev.payments[field],
              ...value
            }
          }
        }));
        
        // Update payment status based on received payments
        const updatedFormData = {
          ...formData,
          payments: {
            ...formData.payments,
            [field]: {
              ...formData.payments[field],
              ...value
            }
          }
        };
        
        // Skip auto status update if in full payment mode
        if (!formData.payments.isFullPayment) {
          // Check if payments were received
          const depositReceived = field === 'deposit' && 'received' in value ? 
            value.received : updatedFormData.payments.deposit.received;
          const remainingReceived = field === 'remaining' && 'received' in value ? 
            value.received : updatedFormData.payments.remaining.received;
          
          let newStatus = 'pending';
          if (depositReceived && remainingReceived) {
            newStatus = 'paid';
          } else if (depositReceived) {
            newStatus = 'deposit';
          }
          
          setFormData(prev => ({
            ...prev,
            payments: {
              ...prev.payments,
              status: newStatus
            }
          }));
        }
      }
      return;
    }
    
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
      return;
    }
    
    // Handle direct fields
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Calculate commission amount when price or rate changes
  useEffect(() => {
    if (formData.price && formData.source.commission.rate && formData.source.type !== 'direct') {
      const commissionAmount = (parseFloat(formData.price) * parseFloat(formData.source.commission.rate) / 100).toFixed(2);
      setFormData(prev => ({
        ...prev,
        source: {
          ...prev.source,
          commission: {
            ...prev.source.commission,
            amount: commissionAmount
          }
        }
      }));
    }
  }, [formData.price, formData.source.commission.rate, formData.source.type]);
  
  // Handle booking submission (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Calculate total paid based on received payments
      const depositAmount = parseFloat(formData.payments.deposit.amount) || 0;
      const remainingAmount = parseFloat(formData.payments.remaining.amount) || 0;
      const totalPaid = 
        (formData.payments.deposit.received ? depositAmount : 0) +
        (formData.payments.remaining.received ? remainingAmount : 0);
      
      // Build booking data in format compatible with your existing system
      const bookingData = {
        clientDetails: {
          name: formData.clientDetails.name,
          phone: formData.clientDetails.phone,
          email: formData.clientDetails.email,
        },
        clientName: formData.clientDetails.name,
        bookingDate: formData.date,
        date: formData.date,
        bookingDetails: {
          boatCompany: "San Antonio Boats",
          boatName: tourTypes.find(t => t.id === formData.tourType)?.name || "Standard Tour",
          passengers: parseInt(formData.passengers),
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
        },
        pricing: {
          agreedPrice: parseFloat(formData.price),
          totalPaid: totalPaid,
          paymentStatus: formData.payments.status,
          payments: formData.payments.isFullPayment ? 
            [
              {
                type: 'full',
                amount: parseFloat(formData.price),
                method: formData.payments.deposit.method,
                received: formData.payments.deposit.received,
                date: formData.payments.deposit.date || new Date().toISOString().split('T')[0],
              }
            ] :
            [
              {
                type: 'deposit',
                amount: depositAmount,
                method: formData.payments.deposit.method,
                received: formData.payments.deposit.received,
                date: formData.payments.deposit.date || new Date().toISOString().split('T')[0],
              },
              {
                type: 'remaining',
                amount: remainingAmount,
                method: formData.payments.remaining.method,
                received: formData.payments.remaining.received,
                date: formData.payments.remaining.date || new Date().toISOString().split('T')[0],
              }
            ]
        },
        // Store payments in both formats for compatibility and easier access
        payments: {
          deposit: {
            amount: depositAmount,
            method: formData.payments.deposit.method,
            received: formData.payments.deposit.received,
            date: formData.payments.deposit.date || new Date().toISOString().split('T')[0],
          },
          remaining: {
            amount: remainingAmount,
            method: formData.payments.remaining.method,
            received: formData.payments.remaining.received,
            date: formData.payments.remaining.date || new Date().toISOString().split('T')[0],
          },
          status: formData.payments.status,
          totalPaid: totalPaid,
          isFullPayment: formData.payments.isFullPayment
        },
        source: {
          type: formData.source.type,
          partnerId: formData.source.partnerId,
          partnerName: formData.source.partnerName,
          commission: {
            rate: parseFloat(formData.source.commission.rate) || 0,
            amount: parseFloat(formData.source.commission.amount) || 0,
            paid: formData.source.commission.paid,
            paymentDate: formData.source.commission.paymentDate
          }
        },
        notes: formData.notes,
        status: "active",
        location: "San Antonio",
        tourType: formData.tourType,
        tourTime: formData.tourTime
      };

      if (editingBookingId) {
        // Update existing booking
        const docRef = doc(db, "bookings", editingBookingId);
        
        // Add lastUpdated field but preserve createdAt
        bookingData.lastUpdated = new Date().toISOString();
        
        await updateDoc(docRef, bookingData);
        
        // Update in the local state
        setBookings(prevBookings => 
          prevBookings.map(booking => 
            booking.id === editingBookingId ? { id: editingBookingId, ...bookingData } : booking
          )
        );
        
        alert("Booking updated successfully!");
      } else {
        // Create new booking
        bookingData.createdAt = new Date().toISOString();
        bookingData.lastUpdated = new Date().toISOString();
        
        const docRef = await addDoc(collection(db, "bookings"), bookingData);
        
        // Add to local state
        setBookings(prev => [{
          id: docRef.id,
          ...bookingData
        }, ...prev]);
        
        alert("Booking added successfully!");
      }
      
      // Reset form and close it
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error("Error saving booking:", error);
      alert(`Error ${editingBookingId ? 'updating' : 'adding'} booking. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle booking details expansion
  const toggleExpand = (id) => {
    setIsExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Filter bookings based on search
  const filteredBookings = bookings.filter(booking => 
    booking.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.source?.partnerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.bookingDetails?.boatName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };
  
  return (
    <div className="p-2 sm:p-4 bg-gray-50 min-h-screen">
      {/* Mobile-optimized header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">San Antonio Tours</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search bookings..."
              className="pl-10 pr-4 py-2 border rounded-lg w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => showForm ? setShowForm(false) : handleAddNew()}
            className="flex items-center justify-center gap-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 w-full sm:w-auto"
          >
            {showForm ? <X size={16} /> : <PlusCircle size={16} />}
            {showForm ? 'Cancel' : 'New Booking'}
          </button>
        </div>
      </div>
      
      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-bold mb-6 text-center">
            {editingBookingId ? 'Edit San Antonio Booking' : 'Add San Antonio Booking'}
          </h2>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
            {/* Client Details Section - Blue accent */}
            <div className="space-y-4 bg-blue-50 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
              <h3 className="font-medium text-gray-800 flex items-center gap-1 pb-2 border-b border-blue-200">
                <Users size={18} className="text-blue-600" />
                <span className="text-blue-800">Client Details</span>
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Name*</label>
                  <input
                    type="text"
                    required
                    value={formData.clientDetails.name}
                    onChange={(e) => handleInputChange('clientDetails', 'name', e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.clientDetails.phone}
                      onChange={(e) => handleInputChange('clientDetails', 'phone', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.clientDetails.email}
                      onChange={(e) => handleInputChange('clientDetails', 'email', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tour Details Section - Green accent */}
            <div className="space-y-4 bg-green-50 p-4 rounded-lg shadow-sm border-l-4 border-green-500">
              <h3 className="font-medium text-gray-800 flex items-center gap-1 pb-2 border-b border-green-200">
                <Ship size={18} className="text-green-600" />
                <span className="text-green-800">Tour Details</span>
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Tour Type*</label>
                    <select
                      required
                      value={formData.tourType}
                      onChange={(e) => handleInputChange('tourType', null, e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {tourTypes.map(tour => (
                        <option key={tour.id} value={tour.id}>{tour.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Time Slot*</label>
                    <select
                      required
                      value={formData.tourTime}
                      onChange={(e) => handleInputChange('tourTime', null, e.target.value)}
                      className="w-full p-2 border rounded"
                      disabled={formData.tourType === 'sunset'}
                    >
                      {Object.entries(timeSlots).map(([key, slot]) => (
                        <option key={key} value={key}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Date*</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => handleInputChange(null, 'date', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Passengers*</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="20"
                      value={formData.passengers}
                      onChange={(e) => handleInputChange(null, 'passengers', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Source & Commission Section - Purple accent */}
            <div className="space-y-4 bg-purple-50 p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
              <h3 className="font-medium text-gray-800 flex items-center gap-1 pb-2 border-b border-purple-200">
                <Percent size={18} className="text-purple-600" />
                <span className="text-purple-800">Source & Commission</span>
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Booking Source*</label>
                    <select
                      required
                      value={formData.source.type}
                      onChange={(e) => handleInputChange('source', 'type', e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {sourceTypes.map(source => (
                        <option key={source.id} value={source.id}>{source.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {formData.source.type === 'hotel' && (
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Select Hotel*</label>
                      <select
                        required
                        value={formData.source.partnerId}
                        onChange={(e) => handleInputChange('source', 'partnerId', e.target.value)}
                        className="w-full p-2 border rounded"
                      >
                        <option value="">Select a hotel</option>
                        {hotels.map(hotel => (
                          <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {formData.source.type === 'collaborator' && (
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Select Collaborator*</label>
                      <select
                        required
                        value={formData.source.partnerId}
                        onChange={(e) => handleInputChange('source', 'partnerId', e.target.value)}
                        className="w-full p-2 border rounded"
                      >
                        <option value="">Select a collaborator</option>
                        {partners.map(partner => (
                          <option key={partner.id} value={partner.id}>{partner.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {formData.source.type === 'website' && (
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Booking Website*</label>
                      <select
                        required
                        value={formData.source.partnerId}
                        onChange={(e) => handleInputChange('source', 'partnerId', e.target.value)}
                        className="w-full p-2 border rounded"
                      >
                        <option value="">Select website</option>
                        {bookingWebsites.map(website => (
                          <option key={website.id} value={website.id}>{website.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                {formData.source.type !== 'direct' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-3 rounded border border-purple-200">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Commission Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.source.commission.rate}
                        onChange={(e) => handleInputChange('source', 'commission', {
                          ...formData.source.commission,
                          rate: e.target.value
                        })}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Commission Amount (€)</label>
                      <input
                        type="text"
                        disabled
                        value={formData.source.commission.amount}
                        className="w-full p-2 border rounded bg-gray-50"
                      />
                    </div>
                    
                    <div className="flex items-center sm:col-span-2">
                      <input
                        type="checkbox"
                        id="commission-paid"
                        checked={formData.source.commission.paid}
                        onChange={(e) => handleInputChange('source', 'commission', {
                          ...formData.source.commission,
                          paid: e.target.checked
                        })}
                        className="mr-2 h-4 w-4"
                      />
                      <label htmlFor="commission-paid" className="text-sm text-gray-700">
                        Commission already paid
                      </label>
                    </div>
                    
                    {formData.source.commission.paid && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm text-gray-700 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={formData.source.commission.paymentDate}
                          onChange={(e) => handleInputChange('source', 'commission', {
                            ...formData.source.commission,
                            paymentDate: e.target.value
                          })}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Payment Details Section - Orange accent */}
            <div className="space-y-4 bg-orange-50 p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
              <h3 className="font-medium text-gray-800 flex items-center gap-1 pb-2 border-b border-orange-200">
                <Euro size={18} className="text-orange-600" />
                <span className="text-orange-800">Payment Details</span>
              </h3>
              
              <div>
                <label className="block text-sm text-gray-700 mb-1">Total Price (€)*</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', null, e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              {/* Full Payment Option */}
              <div className="flex items-center py-3 px-4 bg-orange-100 rounded-lg border border-orange-200">
                <input
                  type="checkbox"
                  id="full-payment"
                  checked={formData.payments.isFullPayment}
                  onChange={(e) => handleInputChange('payments', 'isFullPayment', e.target.checked)}
                  className="mr-3 h-5 w-5"
                />
                <label htmlFor="full-payment" className="text-orange-800 font-medium">
                  Full payment received (€{formData.price})
                </label>
              </div>
              
              {/* Payment Sections - Only show if not full payment */}
              {!formData.payments.isFullPayment ? (
                <>
                  {/* Deposit Payment */}
                  <div className="border rounded-lg p-3 sm:p-4 bg-white border-orange-200">
                    <h4 className="font-medium text-orange-800 mb-3 text-sm sm:text-base">Deposit Payment</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Amount (€)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.payments.deposit.amount}
                          onChange={(e) => handleInputChange('payments', 'deposit', {
                            ...formData.payments.deposit,
                            amount: e.target.value
                          })}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Payment Method</label>
                        <select
                          value={formData.payments.deposit.method}
                          onChange={(e) => handleInputChange('payments', 'deposit', {
                            ...formData.payments.deposit,
                            method: e.target.value
                          })}
                          className="w-full p-2 border rounded"
                        >
                          {paymentMethods.map(method => (
                            <option key={method} value={method}>{method.charAt(0).toUpperCase() + method.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="deposit-received"
                          checked={formData.payments.deposit.received}
                          onChange={(e) => handleInputChange('payments', 'deposit', {
                            ...formData.payments.deposit,
                            received: e.target.checked
                          })}
                          className="mr-2 h-4 w-4"
                        />
                        <label htmlFor="deposit-received" className="text-sm text-gray-700">
                          Deposit received
                        </label>
                      </div>
                      
                      {formData.payments.deposit.received && (
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Date Received</label>
                          <input
                            type="date"
                            value={formData.payments.deposit.date}
                            onChange={(e) => handleInputChange('payments', 'deposit', {
                              ...formData.payments.deposit,
                              date: e.target.value
                            })}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Remaining Payment */}
                  <div className="border rounded-lg p-3 sm:p-4 bg-white border-orange-200">
                    <h4 className="font-medium text-orange-800 mb-3 text-sm sm:text-base">Remaining Payment</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Amount (€)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.payments.remaining.amount}
                          onChange={(e) => handleInputChange('payments', 'remaining', {
                            ...formData.payments.remaining,
                            amount: e.target.value
                          })}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Payment Method</label>
                        <select
                          value={formData.payments.remaining.method}
                          onChange={(e) => handleInputChange('payments', 'remaining', {
                            ...formData.payments.remaining,
                            method: e.target.value
                          })}
                          className="w-full p-2 border rounded"
                        >
                          {paymentMethods.map(method => (
                            <option key={method} value={method}>{method.charAt(0).toUpperCase() + method.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="remaining-received"
                          checked={formData.payments.remaining.received}
                          onChange={(e) => handleInputChange('payments', 'remaining', {
                            ...formData.payments.remaining,
                            received: e.target.checked
                          })}
                          className="mr-2 h-4 w-4"
                        />
                        <label htmlFor="remaining-received" className="text-sm text-gray-700">
                          Remaining amount received
                        </label>
                      </div>
                      
                      {formData.payments.remaining.received && (
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Date Received</label>
                          <input
                            type="date"
                            value={formData.payments.remaining.date}
                            onChange={(e) => handleInputChange('payments', 'remaining', {
                              ...formData.payments.remaining,
                              date: e.target.value
                            })}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Full Payment Details */
                <div className="border rounded-lg p-3 sm:p-4 bg-white border-orange-200">
                  <h4 className="font-medium text-orange-800 mb-3 text-sm sm:text-base">Payment Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Payment Method</label>
                      <select
                        value={formData.payments.deposit.method}
                        onChange={(e) => handleInputChange('payments', 'deposit', {
                          ...formData.payments.deposit,
                          method: e.target.value
                        })}
                        className="w-full p-2 border rounded"
                      >
                        {paymentMethods.map(method => (
                          <option key={method} value={method}>{method.charAt(0).toUpperCase() + method.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Date Received</label>
                      <input
                        type="date"
                        value={formData.payments.deposit.date}
                        onChange={(e) => handleInputChange('payments', 'deposit', {
                          ...formData.payments.deposit,
                          date: e.target.value
                        })}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-2">
                <label className="block text-sm text-gray-700 mb-1">Notes</label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => handleInputChange(null, 'notes', e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Important details, special requests, etc."
                />
              </div>
              
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end pt-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="mt-2 sm:mt-0 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="sr-only sm:not-sr-only">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{editingBookingId ? 'Update Booking' : 'Save Booking'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      
      {/* Bookings List - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gray-50 border-b flex justify-between items-center">
          <h2 className="font-bold">San Antonio Bookings</h2>
          <span className="text-xs sm:text-sm text-gray-500">{filteredBookings.length} bookings</span>
        </div>
        
        {isLoading && !bookings.length ? (
          <div className="p-6 text-center">
            <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-600">Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">No bookings found. Add your first San Antonio booking!</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredBookings.map(booking => (
              <div key={booking.id} className="hover:bg-gray-50">
                <div 
                  className="px-3 py-3 sm:px-6 sm:py-4 flex justify-between items-center cursor-pointer"
                  onClick={() => toggleExpand(booking.id)}
                >
                  <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div className="hidden sm:block">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
                        <Ship size={18} />
                      </div>
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base truncate">{booking.clientName || 'Unnamed Client'}</h3>
                      <div className="text-xs sm:text-sm text-gray-500 flex flex-wrap gap-x-2 gap-y-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(booking.date || booking.bookingDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {booking.bookingDetails?.startTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {booking.bookingDetails?.passengers}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4 ml-2">
                    {/* Payment Status Badge - Only on larger screens */}
                    <div className={`hidden sm:block px-2 sm:px-3 py-1 rounded-full text-xs font-medium
                      ${booking.pricing?.paymentStatus === 'paid' || booking.payments?.status === 'paid' ? 'bg-green-100 text-green-800' : 
                        booking.pricing?.paymentStatus === 'deposit' || booking.payments?.status === 'deposit' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'}`}>
                      {booking.payments?.status === 'paid' || booking.pricing?.paymentStatus === 'paid' ? 'Paid' : 
                       booking.payments?.status === 'deposit' || booking.pricing?.paymentStatus === 'deposit' ? 'Deposit' : 
                       'Pending'}
                    </div>
                    
                    {/* Price */}
                    <div className="text-right">
                      <div className="font-medium text-sm sm:text-base">€{booking.pricing?.agreedPrice}</div>
                      <div className="hidden sm:block text-xs text-gray-500 truncate max-w-[100px]">
                        {booking.bookingDetails?.boatName || 'San Antonio Tour'}
                      </div>
                    </div>
                    
                    {/* Mobile-friendly action buttons - Stack on small screens */}
                    <div className="flex sm:flex-row gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(booking.id);
                        }}
                        className="p-1 rounded-full hover:bg-blue-100 text-blue-600"
                        title="Edit booking"
                        aria-label="Edit booking"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(booking.id);
                        }}
                        className="p-1 rounded-full hover:bg-red-100 text-red-600"
                        title="Delete booking"
                        aria-label="Delete booking"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    {/* Expand/Collapse Icon */}
                    <div className={`transition-transform duration-200 ${isExpanded[booking.id] ? 'rotate-90' : ''}`}>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
                
                {/* Mobile-friendly expanded details view - color-coded sections */}
                {isExpanded[booking.id] && (
                  <div className="px-3 py-3 sm:px-6 sm:py-4 bg-gray-50 text-sm">
                    {/* Client Details - Blue accent */}
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-blue-700 flex items-center gap-1">
                        <Users size={16} className="text-blue-500" />
                        Client Details
                      </h4>
                      <div className="bg-blue-50 p-2 sm:p-3 rounded border border-blue-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-gray-500">Name:</span> {booking.clientName}</div>
                          <div><span className="text-gray-500">Phone:</span> {booking.clientDetails?.phone || 'N/A'}</div>
                          <div className="col-span-2"><span className="text-gray-500">Email:</span> {booking.clientDetails?.email || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tour Details - Green accent */}
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-green-700 flex items-center gap-1">
                        <Ship size={16} className="text-green-500" />
                        Tour Details
                      </h4>
                      <div className="bg-green-50 p-2 sm:p-3 rounded border border-green-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-gray-500">Tour:</span> {booking.bookingDetails?.boatName || 'San Antonio Tour'}</div>
                          <div><span className="text-gray-500">Date:</span> {formatDate(booking.date || booking.bookingDate)}</div>
                          <div><span className="text-gray-500">Time:</span> {booking.bookingDetails?.startTime} - {booking.bookingDetails?.endTime}</div>
                          <div><span className="text-gray-500">Passengers:</span> {booking.bookingDetails?.passengers}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Details - Orange accent */}
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-orange-700 flex items-center gap-1">
                        <Euro size={16} className="text-orange-500" />
                        Payment Details
                      </h4>
                      <div className="bg-orange-50 p-2 sm:p-3 rounded border border-orange-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                          <div>
                            <span className="text-gray-500 text-xs block sm:inline">Total:</span> 
                            <span className="font-medium">€{booking.pricing?.agreedPrice}</span>
                          </div>
                          
                          {booking.payments?.isFullPayment ? (
                            <div className="col-span-3">
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                Full Payment Received
                              </span>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="text-gray-500 text-xs block sm:inline">Deposit:</span> 
                                {booking.payments?.deposit?.received ? (
                                  <span className="text-green-600"> €{booking.payments.deposit.amount} ✓</span>
                                ) : booking.pricing?.payments && booking.pricing?.payments[0]?.received ? (
                                  <span className="text-green-600"> €{booking.pricing.payments[0].amount} ✓</span>
                                ) : (
                                  <span className="text-orange-600"> Pending</span>
                                )}
                              </div>
                              
                              <div>
                                <span className="text-gray-500 text-xs block sm:inline">Remaining:</span> 
                                {booking.payments?.remaining?.received ? (
                                  <span className="text-green-600"> €{booking.payments.remaining.amount} ✓</span>
                                ) : booking.pricing?.payments && booking.pricing?.payments[1]?.received ? (
                                  <span className="text-green-600"> €{booking.pricing.payments[1].amount} ✓</span>
                                ) : (
                                  <span className="text-orange-600"> Pending</span>
                                )}
                              </div>
                              
                              <div>
                                <span className="text-gray-500 text-xs block sm:inline">Status:</span> 
                                <span className={`font-medium 
                                  ${booking.payments?.status === 'paid' || booking.pricing?.paymentStatus === 'paid' ? 'text-green-600' : 
                                  booking.payments?.status === 'deposit' || booking.pricing?.paymentStatus === 'deposit' ? 'text-yellow-600' : 
                                  'text-red-600'}`}>
                                  {booking.payments?.status || booking.pricing?.paymentStatus || 'Pending'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Commission details if applicable - Purple accent */}
                    {booking.source?.type !== 'direct' && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2 text-purple-700 flex items-center gap-1">
                          <Percent size={16} className="text-purple-500" />
                          Commission Details
                        </h4>
                        <div className="bg-purple-50 p-2 sm:p-3 rounded border border-purple-200">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
                            <div>
                              <span className="text-gray-500 text-xs block sm:inline">Source:</span> 
                              <span className="font-medium">{booking.source?.partnerName}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs block sm:inline">Rate:</span> 
                              <span className="font-medium">{booking.source?.commission?.rate}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs block sm:inline">Amount:</span> 
                              <span className="font-medium">€{booking.source?.commission?.amount}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs block sm:inline">Status:</span> 
                              <span className={booking.source?.commission?.paid ? 'text-green-600' : 'text-orange-600'}>
                                {booking.source?.commission?.paid ? 'Paid' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Notes if available */}
                    {booking.notes && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2 text-gray-700">Notes</h4>
                        <p className="text-gray-700 bg-white p-2 sm:p-3 rounded border border-gray-200">{booking.notes}</p>
                      </div>
                    )}

                    {/* Touch-friendly edit button at the bottom */}
                    <div className="flex justify-center sm:justify-end mt-4">
                      <button
                        onClick={() => handleEdit(booking.id)}
                        className="flex items-center justify-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 w-full sm:w-auto"
                      >
                        <Edit size={16} />
                        Edit Booking
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SanAntonioBookingsAdmin;