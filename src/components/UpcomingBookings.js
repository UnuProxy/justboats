import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Ship, Clock, Users, Euro, MapPin, Home, FileText } from 'lucide-react';
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
import { useAuth } from '../context/AuthContext';

function UpcomingBookings() {
  // Get URL parameters for booking highlight
  const [searchParams] = useSearchParams();
  const viewBookingId = searchParams.get('view');
  const { isAdmin, isEmployee, isDriver, isStaff } = useAuth();
  const isAdminUser = isAdmin?.();
  const isEmployeeUser = isEmployee?.();
  const isDriverUser = isDriver?.();
  const isStaffUser = isStaff?.();
  const redactedText = "Not available";
  const driverDestinationFallback = "To be confirmed";

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
  const normalizeBookingData = useCallback((booking, bookingId) => {
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
  
    const normalizedBooking = {
      id: bookingId,
      clientType: booking.clientType || "Direct",
      partnerName: partnerName,
      clientName: booking.clientDetails?.name || booking.clientName || "N/A",
      clientPhone: booking.clientDetails?.phone || "N/A",
      clientEmail: booking.clientDetails?.email || "N/A",
      clientPassport: booking.clientDetails?.passportNumber || "N/A",
      boatCompanyName: booking.bookingDetails?.boatCompany || "N/A",
      boatName: booking.bookingDetails?.boatName || "N/A",
      numberOfPassengers: passengers === undefined || passengers === null ? 0 : parseInt(passengers, 10),
      bookingDate,
      startTime: booking.bookingDetails?.startTime || "N/A",
      endTime: booking.bookingDetails?.endTime || "N/A",
      basePrice,
      discount,
      finalPrice,
      paymentStatus: booking.pricing?.paymentStatus || "No Payment",
      privateTransfer: booking.transfer?.required || false,
      pickupLocation: booking.transfer?.pickup?.location || "",
      pickupLocationDetail: booking.transfer?.pickup?.locationDetail || "",
      dropoffLocation: booking.transfer?.dropoff?.location || "",
      dropoffLocationDetail: booking.transfer?.dropoff?.locationDetail || "",
      pickupAddress: booking.transfer?.pickup?.address || "",
      dropoffAddress: booking.transfer?.dropoff?.address || "",
      clientNotes: booking.notes || "None",
      restaurantName: booking.restaurantName || "",
      isCancelled: booking.status === "cancelled" || booking.isCancelled || false,
      clientDetails: booking.clientDetails || {},
      tripHandlingType: booking.tripHandling?.type || "internal",
      tripHandlingCompany: booking.tripHandling?.company || ""
    };

    if (isDriverUser) {
      if (normalizedBooking.tripHandlingType === 'external') {
        return null;
      }
      return {
        id: bookingId,
        clientType: normalizedBooking.clientType,
        partnerName: normalizedBooking.partnerName,
        clientName: normalizedBooking.clientName,
        bookingDate: normalizedBooking.bookingDate,
        startTime: normalizedBooking.startTime,
        endTime: normalizedBooking.endTime,
        pickupLocation: normalizedBooking.pickupLocation,
        pickupLocationDetail: normalizedBooking.pickupLocationDetail,
        dropoffLocation: normalizedBooking.dropoffLocation,
        dropoffLocationDetail: normalizedBooking.dropoffLocationDetail,
        privateTransfer: normalizedBooking.privateTransfer,
        isCancelled: normalizedBooking.isCancelled,
        finalPrice: normalizedBooking.finalPrice || 0,
        numberOfPassengers: normalizedBooking.numberOfPassengers || 0,
        tripHandlingType: normalizedBooking.tripHandlingType
      };
    }

    if ((isEmployeeUser || isStaffUser) && !isAdminUser) {
      const sanitizedBooking = {
        ...booking,
        ...normalizedBooking,
        clientEmail: redactedText,
        clientPhone: redactedText,
        clientPassport: null,
        clientNotes: null,
        clientDetails: { name: normalizedBooking.clientName }
      };
      delete sanitizedBooking.contact;
      delete sanitizedBooking.contactInfo;
      return sanitizedBooking;
    }
  
    return {
      ...booking,
      ...normalizedBooking
    };
  }, [getPartnerName, isAdminUser, isDriverUser, isEmployeeUser]);

  // Real-time listener setup for base bookings
  useEffect(() => {
    setLoading(true);
    const bookingsRef = collection(db, 'bookings');
    const q = query(bookingsRef, firestoreOrderBy('bookingDetails.date', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bookingsData = snapshot.docs
          .map(doc => normalizeBookingData(doc.data(), doc.id))
          .filter(Boolean);
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

  const getContactDisplay = (booking) => {
    if ((isDriverUser || isEmployeeUser || isStaffUser) && !isAdminUser) {
      return redactedText;
    }
    return booking.clientEmail || booking.clientPhone || '';
  };

  const getDriverTripStops = (booking) => {
    const from =
      booking.pickupAddress ||
      booking.pickupLocationDetail ||
      booking.pickupLocation ||
      (booking.clientType === 'Hotel' ? booking.partnerName || "Hotel" : driverDestinationFallback);
    const to =
      booking.dropoffAddress ||
      booking.dropoffLocationDetail ||
      booking.dropoffLocation ||
      driverDestinationFallback;
    return {
      from: from || driverDestinationFallback,
      to: to || driverDestinationFallback
    };
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
      const base = (isDriverUser && !isAdminUser)
        ? bookings.filter(b =>
            b.privateTransfer ||
            b.pickupLocationDetail ||
            b.pickupLocation ||
            b.pickupAddress ||
            b.dropoffLocationDetail ||
            b.dropoffLocation ||
            b.dropoffAddress
          )
        : bookings;
      setFilteredBookings(base);
      return;
    }
    
    let filtered = (isDriverUser && !isAdminUser)
      ? bookings.filter(b =>
          b.privateTransfer ||
          b.pickupLocationDetail ||
          b.pickupLocation ||
          b.pickupAddress ||
          b.dropoffLocationDetail ||
          b.dropoffLocation ||
          b.dropoffAddress
        )
      : bookings;
    
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(booking => {
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
  }, [bookings, filters, isSearchMode, isDriverUser, isAdminUser]);

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
    if (isDriverUser) return;
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
            locationDetail: updatedBooking.pickupLocationDetail || "",
            address: updatedBooking.pickupAddress,
            time: updatedBooking.pickupTime || updatedBooking.startTime || ""
          },
          dropoff: {
            location: updatedBooking.dropoffLocation,
            locationDetail: updatedBooking.dropoffLocationDetail || "",
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
    if (isDriverUser) {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-blue-500 text-white px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <h3 className="font-semibold text-lg">Driver View</h3>
                <span className="text-sm">
                  {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'} available
                </span>
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">No trips match your search criteria</p>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {filteredBookings.map((booking) => (
                  <div
                    key={booking.id}
                    id={`booking-${booking.id}`}
                    className="relative overflow-hidden p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-bold text-base text-gray-900 truncate">
                          {booking.clientName}
                        </h4>
                        <div className="text-xs text-gray-500">
                          {formatDateForDisplay(booking.bookingDate)}
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">
                        {booking.startTime !== 'N/A' ? booking.startTime : 'Time pending'}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-gray-800">
                      {(() => {
                        const stops = getDriverTripStops(booking);
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-blue-600" />
                              <span className="font-semibold">From</span>
                              <span className="truncate">{stops.from}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold">To</span>
                              <span className="truncate">{stops.to}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

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
            <div className="p-3 space-y-3">
              {filteredBookings.map((booking) => (
                <div
                  key={booking.id}
                  id={`booking-${booking.id}`}
                  onClick={() => handleBookingSelect(booking)}
                  className="group relative overflow-hidden p-4 bg-white hover:bg-gray-50 cursor-pointer rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300"
                >
                  {/* Left border payment status indicator */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    booking.isCancelled ? 'bg-red-500' :
                    booking.paymentStatus === 'Completed' ? 'bg-green-500' :
                    booking.paymentStatus === 'Partial' ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`}></div>

                  <div className="flex flex-col gap-3 pl-3">
                    {/* Header Section */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h4 className="font-bold text-base text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {booking.clientName}
                          </h4>
                          <span className="text-xs text-gray-500 font-medium">
                            {formatDateForDisplay(booking.bookingDate)}
                          </span>
                          {(booking.clientType === 'Hotel' || booking.clientType === 'Collaborator') && booking.partnerName && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              booking.clientType === 'Hotel'
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : 'bg-green-100 text-green-700 border-green-200'
                            }`}>
                              {booking.partnerName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 truncate">{getContactDisplay(booking)}</div>
                      </div>

                      {/* Payment Status Badge */}
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                          booking.isCancelled
                            ? 'bg-red-100 text-red-700 border-red-300' :
                          booking.paymentStatus === 'Completed'
                            ? 'bg-green-100 text-green-700 border-green-300' :
                          booking.paymentStatus === 'Partial'
                            ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                          'bg-gray-100 text-gray-700 border-gray-300'
                        }`}>
                          {booking.paymentStatus === 'Completed' && '✓ '}
                          {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                        </span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100"></div>

                    {/* Main Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Boat */}
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                          <Ship className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Boat</div>
                          <div className="text-sm font-medium text-gray-900 truncate">{booking.boatName}</div>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 text-white shadow-sm">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Time</div>
                          <div className="text-sm font-medium text-gray-900">{booking.startTime} - {booking.endTime}</div>
                        </div>
                      </div>

                      {/* Passengers */}
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-sm">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Guests</div>
                          <div className="text-sm font-medium text-gray-900">{booking.numberOfPassengers || 0} pax</div>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm">
                          <Euro className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Price</div>
                          <div className="text-sm font-bold text-gray-900">€{booking.finalPrice.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Services */}
                    {(booking.privateTransfer || booking.restaurantName) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {booking.privateTransfer && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-100 border border-yellow-200">
                            <MapPin className="h-3.5 w-3.5 text-yellow-700" />
                            <span className="text-xs font-semibold text-yellow-700">Transfer</span>
                          </div>
                        )}

                        {booking.restaurantName && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 border border-red-200">
                            <Home className="h-3.5 w-3.5 text-red-700" />
                            <span className="text-xs font-semibold text-red-700">{booking.restaurantName}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes Section */}
                    {booking.clientNotes && booking.clientNotes !== 'None' && (
                      <div className="bg-yellow-50 p-2.5 rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-2">
                          <FileText className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-yellow-800">Note: </span>
                            <span className="text-xs text-yellow-700">{booking.clientNotes}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hover "View Details" Indicator */}
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold shadow-md">
                        View Details →
                      </span>
                    </div>
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
    if (isDriverUser) {
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
                        className="relative overflow-hidden p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="font-bold text-base text-gray-900 truncate">
                              {booking.clientName}
                            </h4>
                            <div className="text-xs text-gray-500">
                              {formatDateForDisplay(booking.bookingDate)}
                            </div>
                          </div>
                      <div className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">
                        {booking.startTime !== 'N/A' ? booking.startTime : 'Time pending'}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-gray-800">
                      {(() => {
                        const stops = getDriverTripStops(booking);
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-blue-600" />
                              <span className="font-semibold">From</span>
                              <span className="truncate">{stops.from}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold">To</span>
                              <span className="truncate">{stops.to}</span>
                            </div>
                          </>
                        );
                      })()}
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
    }

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
                      className="group relative overflow-hidden p-4 bg-white hover:bg-gray-50 transition-all duration-200 cursor-pointer rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-300"
                      onClick={() => handleBookingSelect(booking)}
                    >
                      {/* Left border payment status indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        booking.isCancelled ? 'bg-red-500' :
                        booking.paymentStatus === 'Completed' ? 'bg-green-500' :
                        booking.paymentStatus === 'Partial' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`}></div>

                      <div className="flex flex-col gap-3 pl-3">
                        {/* Header Section */}
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className="font-bold text-base text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                {booking.clientName}
                              </h4>
                              {(booking.clientType === 'Hotel' || booking.clientType === 'Collaborator') && booking.partnerName && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  booking.clientType === 'Hotel'
                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                    : 'bg-green-100 text-green-700 border-green-200'
                                }`}>
                                  {booking.partnerName}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 truncate">{getContactDisplay(booking)}</div>
                          </div>

                          {/* Payment Status Badge - More Prominent */}
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                              booking.isCancelled
                                ? 'bg-red-100 text-red-700 border-red-300' :
                              booking.paymentStatus === 'Completed'
                                ? 'bg-green-100 text-green-700 border-green-300' :
                              booking.paymentStatus === 'Partial'
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                              'bg-gray-100 text-gray-700 border-gray-300'
                            }`}>
                              {booking.paymentStatus === 'Completed' && '✓ '}
                              {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                            </span>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-100"></div>

                        {/* Main Info Grid - Compact Layout */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Boat */}
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                              <Ship className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Boat</div>
                              <div className="text-sm font-medium text-gray-900 truncate">{booking.boatName}</div>
                            </div>
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 text-white shadow-sm">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Time</div>
                              <div className="text-sm font-medium text-gray-900">{booking.startTime} - {booking.endTime}</div>
                            </div>
                          </div>

                          {/* Passengers */}
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-sm">
                              <Users className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Guests</div>
                              <div className="text-sm font-medium text-gray-900">{booking.numberOfPassengers || 0} pax</div>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm">
                              <Euro className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Price</div>
                              <div className="text-sm font-bold text-gray-900">€{booking.finalPrice.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Additional Services */}
                        {(booking.privateTransfer || booking.restaurantName) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {booking.privateTransfer && (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-100 border border-yellow-200">
                                <MapPin className="h-3.5 w-3.5 text-yellow-700" />
                                <span className="text-xs font-semibold text-yellow-700">Transfer: {booking.pickupLocation} → {booking.dropoffLocation}</span>
                              </div>
                            )}

                            {booking.restaurantName && (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 border border-red-200">
                                <Home className="h-3.5 w-3.5 text-red-700" />
                                <span className="text-xs font-semibold text-red-700">{booking.restaurantName}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Notes Section - Compact */}
                        {booking.clientNotes && booking.clientNotes !== 'None' && (
                          <div className="bg-yellow-50 p-2.5 rounded-lg border border-yellow-200">
                            <div className="flex items-start gap-2">
                              <FileText className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-semibold text-yellow-800">Note: </span>
                                <span className="text-xs text-yellow-700">{booking.clientNotes}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Hover "View Details" Indicator */}
                        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold shadow-md">
                            View Details →
                          </span>
                        </div>
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
      
      {selectedBooking && !isDriverUser && (
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
