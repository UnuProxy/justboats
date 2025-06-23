import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Ship, Clock, Users, Euro, MapPin, Home } from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy as firestoreOrderBy,
  doc,
  deleteDoc,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import BookingDetails from './BookingDetails';
import { useSearchParams } from 'react-router-dom';
import CalendarPicker from './CalendarPicker';

function UpcomingBookings() {
  // Get URL parameters for booking highlight
  const [searchParams] = useSearchParams();
  const viewBookingId = searchParams.get('view');

  // State variables
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  

  
  // Partners state
  const [hotels, setHotels] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [partnersLoaded, setPartnersLoaded] = useState(false);
  
  // Timeline view variables
  const visibleDays = 5;
  const [startDate, setStartDate] = useState(new Date());
  
  // Date filter variables
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
  });
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Highlight effect for selected booking
  useEffect(() => {
    if (viewBookingId) {
      const bookingElement = document.getElementById(`booking-${viewBookingId}`);
      if (bookingElement) {
        bookingElement.scrollIntoView({ behavior: 'smooth' });
        bookingElement.classList.add('bg-blue-50');
        
        setTimeout(() => {
          bookingElement.classList.remove('bg-blue-50');
        }, 3000);
      }
    }
  }, [viewBookingId, filteredBookings]);

  // Fetch partners data
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        // Fetch hotels
        const hotelsRef = collection(db, 'hotels');
        const hotelsSnapshot = await getDocs(hotelsRef);
        const hotelsData = hotelsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setHotels(hotelsData);

        // Fetch collaborators
        const collaboratorsRef = collection(db, 'collaborators');
        const collaboratorsSnapshot = await getDocs(collaboratorsRef);
        const collaboratorsData = collaboratorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCollaborators(collaboratorsData);

        setPartnersLoaded(true);
      } catch (error) {
        console.error('Error fetching partners:', error);
        setPartnersLoaded(true);
      }
    };

    fetchPartners();
  }, []);

  // Normalize date for comparisons
  const normalizeDate = (dateString) => {
    if (!dateString) return null;
    if (dateString === "N/A") return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch (e) {
      console.error('Error parsing date:', dateString, e);
      return null;
    }
  };

  // Get partner name helper
  const getPartnerName = useCallback((booking) => {
    if (!partnersLoaded) return 'Loading...';
    
    // Debug: Log all potential partner fields for this booking
    console.log('=== PARTNER DEBUG ===');
    console.log('Booking ID:', booking.id);
    console.log('Client Type:', booking.clientType);
    console.log('All potential partner fields:', {
      selectedPartnerName: booking.selectedPartnerName,
      partnerName: booking.partnerName,
      hotelName: booking.hotelName,
      collaboratorName: booking.collaboratorName,
      partner: booking.partner,
      hotel: booking.hotel,
      selectedPartner: booking.selectedPartner,
      'partner.name': booking.partner?.name,
      'hotel.name': booking.hotel?.name
    });
    console.log('Available hotels:', hotels.map(h => ({ id: h.id, name: h.name })));
    console.log('Available collaborators:', collaborators.map(c => ({ id: c.id, name: c.name })));
    console.log('====================');
    
    if (booking.clientType === 'Hotel') {
      // Try all possible hotel ID fields
      const possibleIds = [
        booking.selectedPartnerName,
        booking.partnerName,
        booking.hotelName,
        booking.selectedPartner,
        booking.partner,
        booking.hotel,
        booking.partner?.id,
        booking.hotel?.id
      ].filter(Boolean);
      
      // Try all possible hotel name fields
      const possibleNames = [
        booking.selectedPartnerName,
        booking.partnerName,
        booking.hotelName,
        booking.partner?.name,
        booking.hotel?.name
      ].filter(Boolean);
      
      // First try to find by ID
      for (const id of possibleIds) {
        const hotel = hotels.find(h => h.id === id);
        if (hotel) {
          console.log('Found hotel by ID:', hotel.name);
          return hotel.name;
        }
      }
      
      // Then try to find by name
      for (const name of possibleNames) {
        const hotel = hotels.find(h => h.name === name);
        if (hotel) {
          console.log('Found hotel by name:', hotel.name);
          return hotel.name;
        }
      }
      
      // Return the first available name as fallback
      const fallbackName = possibleNames[0] || 'Unknown Hotel';
      console.log('Using fallback hotel name:', fallbackName);
      return fallbackName;
    }
    
    if (booking.clientType === 'Collaborator') {
      // Try all possible collaborator ID fields
      const possibleIds = [
        booking.selectedPartnerName,
        booking.partnerName,
        booking.collaboratorName,
        booking.selectedPartner,
        booking.partner,
        booking.collaborator,
        booking.partner?.id,
        booking.collaborator?.id
      ].filter(Boolean);
      
      // Try all possible collaborator name fields
      const possibleNames = [
        booking.selectedPartnerName,
        booking.partnerName,
        booking.collaboratorName,
        booking.partner?.name,
        booking.collaborator?.name
      ].filter(Boolean);
      
      // First try to find by ID
      for (const id of possibleIds) {
        const collaborator = collaborators.find(c => c.id === id);
        if (collaborator) {
          console.log('Found collaborator by ID:', collaborator.name);
          return collaborator.name;
        }
      }
      
      // Then try to find by name
      for (const name of possibleNames) {
        const collaborator = collaborators.find(c => c.name === name);
        if (collaborator) {
          console.log('Found collaborator by name:', collaborator.name);
          return collaborator.name;
        }
      }
      
      // Return the first available name as fallback
      const fallbackName = possibleNames[0] || 'Unknown Collaborator';
      console.log('Using fallback collaborator name:', fallbackName);
      return fallbackName;
    }
    
    return '';
  }, [hotels, collaborators, partnersLoaded]);

  // Normalize booking data
  const normalizeBookingData = useCallback((booking) => {
    const basePrice = parseFloat(booking.pricing?.basePrice || 0);
    const discount = parseFloat(booking.pricing?.discount || 0);
    const finalPrice = parseFloat(booking.pricing?.agreedPrice || 0) || (basePrice - discount);
    const passengers = booking.bookingDetails?.passengers;
  
    // Get the original booking date
    let bookingDate = booking.bookingDetails?.date || "N/A";
    
    // Try to normalize the date format if it exists
    if (bookingDate && bookingDate !== "N/A") {
      try {
        const dateObj = new Date(bookingDate);
        if (!isNaN(dateObj.getTime())) {
          bookingDate = dateObj.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error('Error normalizing booking date:', bookingDate, e);
      }
    }

    // Get the resolved partner name
    const partnerName = getPartnerName(booking);
  
    return {
      ...booking,
      clientType: booking.clientType || "Direct",
      partnerName: partnerName,
      clientName: booking.clientDetails?.name || "N/A",
      clientPhone: booking.clientDetails?.phone || "N/A",
      clientEmail: booking.clientDetails?.email || "N/A",
      clientPassport: booking.clientDetails?.passportNumber || "N/A",
      boatCompanyName: booking.bookingDetails?.boatCompany || "N/A",
      boatName: booking.bookingDetails?.boatName || "N/A",
      numberOfPassengers: passengers === undefined || passengers === null ? undefined : parseInt(passengers, 10),
      bookingDate,
      startTime: booking.bookingDetails?.startTime || "N/A",
      endTime: booking.bookingDetails?.endTime || "N/A",
      basePrice,
      discount,
      finalPrice,
      paymentStatus: booking.pricing?.paymentStatus || "No Payment",
      privateTransfer: booking.transfer?.required || false,
      pickupLocation: booking.transfer?.pickup?.location || "",
      dropoffLocation: booking.transfer?.dropoff?.location || "",
      pickupAddress: booking.transfer?.pickup?.address || "",
      dropoffAddress: booking.transfer?.dropoff?.address || "",
      clientNotes: booking.notes || "None",
      restaurantName: booking.restaurantName || "",
      isCancelled: booking.status === "cancelled" || booking.isCancelled || false,
    };
  }, [getPartnerName]);

  // Real-time listener setup for base bookings
  useEffect(() => {
    setLoading(true);
    const bookingsRef = collection(db, 'bookings');
    const q = query(bookingsRef, firestoreOrderBy('bookingDetails.date', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bookingsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...normalizeBookingData(doc.data())
        }));
        setBookings(bookingsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching bookings in real time:', err);
        setError('Failed to load bookings');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [normalizeBookingData]);





  // Format date for display (human-readable format)
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Handle date filter changes
  const handleDateChange = (field, value) => {
    let normalizedValue = value;
    
    if (value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          normalizedValue = date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error(`Error normalizing ${field}:`, e);
      }
    }
    
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: normalizedValue,
    }));
  };

  // Apply date filter
  const applyDateFilter = () => {
    setIsFiltering(true);
    setIsSearchMode(true);
    
    setTimeout(() => {
      setIsFiltering(false);
    }, 500);
  };

  // Clear date filter
  const clearDateFilter = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
    });
    setIsSearchMode(false);
  };

  // Filter bookings based on date
  useEffect(() => {
    if (!isSearchMode) {
      setFilteredBookings(bookings);
      return;
    }
    
    let filtered = bookings;
    
    if (filters.dateFrom || filters.dateTo) {
      filtered = bookings.filter(booking => {
        const bookingDate = normalizeDate(booking.bookingDate);
        const fromDate = normalizeDate(filters.dateFrom);
        const toDate = normalizeDate(filters.dateTo);
        
        if ((fromDate || toDate) && bookingDate === null) return false;
        
        if (fromDate && bookingDate && bookingDate < fromDate) return false;
        if (toDate && bookingDate && bookingDate > toDate) return false;
        
        return true;
      });
    }
    
    filtered.sort((a, b) => {
      return new Date(a.bookingDate) - new Date(b.bookingDate);
    });
    
    setFilteredBookings(filtered);
  }, [bookings, filters, isSearchMode]);

  // Get days array for timeline
  const getDaysArray = () => {
    const daysArray = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < visibleDays; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);
      daysArray.push(date);
    }
    
    return daysArray;
  };

  // Format date as YYYY-MM-DD for comparison
  const formatDateForComparison = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Timeline navigation handlers
  const handlePreviousDays = () => {
    const newStartDate = new Date(startDate);
    newStartDate.setDate(newStartDate.getDate() - visibleDays);
    setStartDate(newStartDate);
  };

  const handleNextDays = () => {
    const newStartDate = new Date(startDate);
    newStartDate.setDate(newStartDate.getDate() + visibleDays);
    setStartDate(newStartDate);
  };

  const handleJumpToToday = () => {
    setStartDate(new Date());
  };

  // Get bookings for a specific date
  const getBookingsForDate = (date) => {
    const dateString = formatDateForComparison(date);
    return filteredBookings.filter(booking => booking.bookingDate === dateString);
  };

  // Format date for display in timeline
  const formatDate = (date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    if (isToday) return `Today (${formattedDate})`;
    if (isTomorrow) return `Tomorrow (${formattedDate})`;
    return formattedDate;
  };

  // Determine if a date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Booking handlers
  const handleBookingSelect = (booking) => {
    setSelectedBooking(booking);
  };

  const handleBookingClose = () => {
    setSelectedBooking(null);
  };

  const handleBookingDelete = async (bookingId) => {
    if (window.confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      try {
        const docRef = doc(db, 'bookings', bookingId);
        await deleteDoc(docRef);
        alert('Booking deleted successfully!');
        setSelectedBooking(null);
      } catch (error) {
        console.error('Error deleting booking:', error);
        alert('Failed to delete booking. Please try again.');
      }
    }
  };

  const handleBookingSave = async (bookingId, updatedBooking) => {
    try {
      const docRef = doc(db, "bookings", bookingId);
      
      const dataToUpdate = {
        clientType: updatedBooking.clientType,
        status: updatedBooking.isCancelled ? 'cancelled' : 'active',
        lastUpdated: new Date().toISOString(),
        restaurantName: updatedBooking.restaurantName,
        
        clientDetails: {
          name: updatedBooking.clientName,
          phone: updatedBooking.clientPhone,
          email: updatedBooking.clientEmail,
          passportNumber: updatedBooking.clientPassport
        },
        
        bookingDetails: {
          boatCompany: updatedBooking.boatCompanyName,
          boatName: updatedBooking.boatName,
          passengers: updatedBooking.numberOfPassengers,
          date: updatedBooking.bookingDate,
          startTime: updatedBooking.startTime,
          endTime: updatedBooking.endTime
        },
        
        pricing: {
          agreedPrice: updatedBooking.finalPrice,
          paymentStatus: updatedBooking.paymentStatus
        },
        
        transfer: updatedBooking.privateTransfer ? {
          required: true,
          pickup: {
            location: updatedBooking.pickupLocation,
            address: updatedBooking.pickupAddress
          },
          dropoff: {
            location: updatedBooking.dropoffLocation,
            address: updatedBooking.dropoffAddress
          }
        } : null,
        
        notes: updatedBooking.clientNotes
      };

      await updateDoc(docRef, dataToUpdate);
      alert("Booking updated successfully!");
      setSelectedBooking(null);
    } catch (error) {
      console.error("Error saving booking:", error);
      alert("Failed to update booking. Please try again.");
    }
  };

  // Loading/Filtering Overlay component
  const LoadingOverlay = ({ isActive }) => {
    if (!isActive) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full mx-4">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
            <span className="text-gray-700 font-medium text-lg">Loading bookings...</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Loading state
  if (loading && !isFiltering) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <p className="text-red-800">Error loading bookings: {error}</p>
      </div>
    );
  }

  // Simplified Date Picker
  const SimpleDatePicker = () => {
    const [showFromCalendar, setShowFromCalendar] = useState(false);
    const [showToCalendar, setShowToCalendar] = useState(false);
    
    const getDateDisplay = () => {
      if (filters.dateFrom && filters.dateTo) {
        return `${formatDateForDisplay(filters.dateFrom)} to ${formatDateForDisplay(filters.dateTo)}`;
      } else if (filters.dateFrom) {
        return `From ${formatDateForDisplay(filters.dateFrom)}`;
      } else if (filters.dateTo) {
        return `To ${formatDateForDisplay(filters.dateTo)}`;
      }
      return '';
    };
    
    const handleFromDateSelect = (dateString) => {
      handleDateChange('dateFrom', dateString);
    };
    
    const handleToDateSelect = (dateString) => {
      handleDateChange('dateTo', dateString);
    };
  
    const handleClearAll = () => {
      setFilters({ dateFrom: '', dateTo: '' });
      setIsSearchMode(false);
      setShowFromCalendar(false);
      setShowToCalendar(false);
    };
    
    return (
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-md mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium w-full sm:w-auto justify-center sm:justify-start ${
                isDatePickerOpen ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-300 text-gray-700'
              }`}
            >
              <Calendar className="h-5 w-5" />
              <span>Date Filter</span>
            </button>
            
            {(filters.dateFrom || filters.dateTo) && (
              <span className="text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg text-center">
                {getDateDisplay()}
              </span>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {!isSearchMode && (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={handleJumpToToday}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium"
                >
                  Today
                </button>
                
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    onClick={handlePreviousDays}
                    className="p-2 hover:bg-gray-100 border-r flex-1 sm:flex-none"
                    aria-label="Previous days"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-600 mx-auto" />
                  </button>
                  <button
                    onClick={handleNextDays}
                    className="p-2 hover:bg-gray-100 flex-1 sm:flex-none"
                    aria-label="Next days"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-600 mx-auto" />
                  </button>
                </div>
              </div>
            )}
            
            {isSearchMode && (
              <button
                onClick={clearDateFilter}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium w-full"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
        
        {isDatePickerOpen && (
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mt-3">
            <div className="grid grid-cols-1 gap-4 mb-4">
              {/* From Date Calendar */}
              <div className="bg-white p-3 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">From Date</label>
                  <button
                    onClick={() => setShowFromCalendar(!showFromCalendar)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {showFromCalendar ? 'Hide Calendar' : 'Show Calendar'}
                  </button>
                </div>
                
                <div 
                  className="p-2 border rounded-md cursor-pointer hover:bg-blue-50 mb-2"
                  onClick={() => setShowFromCalendar(true)}
                >
                  {filters.dateFrom ? formatDateForDisplay(filters.dateFrom) : 'Select a date'}
                </div>
                
                {showFromCalendar && (
                  <div className="relative z-10 flex justify-center">
                    <CalendarPicker
                      selectedDate={filters.dateFrom}
                      onChange={handleFromDateSelect}
                      onClose={() => setShowFromCalendar(false)}
                    />
                  </div>
                )}
              </div>
              
              {/* To Date Calendar */}
              <div className="bg-white p-3 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">To Date</label>
                  <button
                    onClick={() => setShowToCalendar(!showToCalendar)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {showToCalendar ? 'Hide Calendar' : 'Show Calendar'}
                  </button>
                </div>
                
                <div 
                  className="p-2 border rounded-md cursor-pointer hover:bg-blue-50 mb-2"
                  onClick={() => setShowToCalendar(true)}
                >
                  {filters.dateTo ? formatDateForDisplay(filters.dateTo) : 'Select a date'}
                </div>
                
                {showToCalendar && (
                  <div className="relative z-10 flex justify-center">
                    <CalendarPicker
                      selectedDate={filters.dateTo}
                      onChange={handleToDateSelect}
                      onClose={() => setShowToCalendar(false)}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                {(filters.dateFrom || filters.dateTo) && (
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium w-full"
                  >
                    Clear Dates
                  </button>
                )}
                <button
                  onClick={() => {
                    applyDateFilter();
                    setShowFromCalendar(false);
                    setShowToCalendar(false);
                  }}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium w-full"
                >
                  Search
                </button>
              </div>
              
              <button
                onClick={() => setIsDatePickerOpen(false)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium w-full"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Search Results View
  const renderSearchResults = () => {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-blue-500 text-white px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <h3 className="font-semibold text-lg">Search Results</h3>
              <span className="text-sm">
                {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'} found
              </span>
            </div>
          </div>
          
          {filteredBookings.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No bookings match your search criteria</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredBookings.map((booking) => (
                <div
                  key={booking.id}
                  id={`booking-${booking.id}`}
                  onClick={() => handleBookingSelect(booking)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <h4 className="font-medium text-gray-900">{booking.clientName}</h4>
                          <span className="text-sm text-gray-500">{formatDateForDisplay(booking.bookingDate)}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{booking.clientEmail || booking.clientPhone}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {booking.clientType === 'Hotel' && booking.partnerName ? 
                            booking.partnerName : 
                            booking.clientType === 'Collaborator' && booking.partnerName ? 
                            booking.partnerName : 
                            booking.clientType
                          }
                        </div>
                      </div>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        booking.isCancelled ? 'bg-red-100 text-red-700' :
                        booking.paymentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                        booking.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Ship className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="truncate">{booking.boatName}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{booking.startTime} - {booking.endTime}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        <span>{booking.numberOfPassengers || 0} passengers</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Euro className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                        <span>€{booking.finalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {(booking.privateTransfer || booking.restaurantName) && (
                      <div className="flex flex-wrap gap-2">
                        {booking.privateTransfer && (
                          <div className="flex items-center gap-1 text-xs bg-yellow-50 px-2 py-1 rounded">
                            <MapPin className="h-3 w-3 text-yellow-500" />
                            <span>Transfer</span>
                          </div>
                        )}
                        
                        {booking.restaurantName && (
                          <div className="flex items-center gap-1 text-xs bg-red-50 px-2 py-1 rounded">
                            <Home className="h-3 w-3 text-red-500" />
                            <span>{booking.restaurantName}</span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Timeline View
  const renderTimelineView = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        {getDaysArray().map((date, index) => {
          const dateBookings = getBookingsForDate(date);
          const dateString = formatDate(date);
          
          return (
            <div key={index} className={`rounded-xl overflow-hidden shadow-md ${isToday(date) ? 'ring-2 ring-blue-500' : ''}`}>
              <div className={`px-4 py-3 ${isToday(date) ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' : 'bg-gradient-to-r from-gray-100 to-gray-200'}`}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{dateString}</h3>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${isToday(date) ? 'bg-white bg-opacity-20' : 'bg-blue-100 text-blue-800'}`}>
                      {dateBookings.length} {dateBookings.length === 1 ? 'booking' : 'bookings'}
                    </span>
                  </div>
                  
                  {dateBookings.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${isToday(date) ? 'bg-white bg-opacity-20' : 'bg-blue-50'}`}>
                        <Users className="h-4 w-4" />
                        <span>
                          {dateBookings.reduce((sum, booking) => sum + (booking.numberOfPassengers || 0), 0)} passengers
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${isToday(date) ? 'bg-white bg-opacity-20' : 'bg-blue-50'}`}>
                        <Euro className="h-4 w-4" />
                        <span>
                          €{dateBookings.reduce((sum, booking) => sum + booking.finalPrice, 0).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {dateBookings.length === 0 ? (
                <div className={`p-6 text-center ${isToday(date) ? 'bg-blue-50' : 'bg-white'}`}>
                  <p className="text-gray-500">No bookings for this day</p>
                </div>
              ) : (
                <div className={`space-y-3 p-3 sm:p-4 ${isToday(date) ? 'bg-blue-50' : 'bg-white'}`}>
                  {dateBookings.map((booking) => (
                    <div 
                      key={booking.id} 
                      id={`booking-${booking.id}`}
                      className="p-4 bg-white hover:bg-gray-50 transition-all cursor-pointer rounded-lg border border-gray-200 shadow-sm hover:shadow-md"
                      onClick={() => handleBookingSelect(booking)}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <h4 className="font-medium text-gray-900 truncate">{booking.clientName}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                                booking.clientType === 'Direct' ? 'bg-blue-100 text-blue-700' :
                                booking.clientType === 'Hotel' ? 'bg-purple-100 text-purple-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {booking.clientType === 'Hotel' && booking.partnerName ? 
                                  booking.partnerName : 
                                  booking.clientType === 'Collaborator' && booking.partnerName ? 
                                  booking.partnerName : 
                                  booking.clientType
                                }
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1 truncate">{booking.clientEmail || booking.clientPhone}</div>
                          </div>
                          
                          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${
                            booking.isCancelled ? 'bg-red-100 text-red-700' :
                            booking.paymentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                            booking.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="bg-blue-100 p-1 rounded-md flex-shrink-0">
                              <Ship className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-medium truncate">{booking.boatName}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="bg-green-100 p-1 rounded-md flex-shrink-0">
                              <Clock className="h-4 w-4 text-green-600" />
                            </div>
                            <span>{booking.startTime} - {booking.endTime}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="bg-purple-100 p-1 rounded-md flex-shrink-0">
                              <Users className="h-4 w-4 text-purple-600" />
                            </div>
                            <span>{booking.numberOfPassengers || 0} passengers</span>
                          </div>
                          
                          {booking.privateTransfer && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <div className="bg-yellow-100 p-1 rounded-md flex-shrink-0">
                                <MapPin className="h-4 w-4 text-yellow-600" />
                              </div>
                              <span className="truncate">Transfer: {booking.pickupLocation} → {booking.dropoffLocation}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <div className="bg-indigo-100 p-1 rounded-md flex-shrink-0">
                              <Euro className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="text-gray-900">€{booking.finalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        {booking.restaurantName && (
                          <div className="text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <div className="bg-red-100 p-1 rounded-md flex-shrink-0">
                                <Home className="h-4 w-4 text-red-600" />
                              </div>
                              <span className="truncate">Restaurant: {booking.restaurantName}</span>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Main component rendering
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 bg-gray-50 min-h-screen">
      <LoadingOverlay isActive={isFiltering} />
      

      
      <SimpleDatePicker />
      
      {isSearchMode ? renderSearchResults() : renderTimelineView()}
      
      {selectedBooking && (
        <BookingDetails
          booking={selectedBooking}
          onClose={handleBookingClose}
          onDelete={handleBookingDelete} 
          onSave={handleBookingSave}
        />
      )}
    </div>
  );
}

export default UpcomingBookings;
