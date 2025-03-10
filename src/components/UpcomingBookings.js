import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter, Ship, Clock, Users, DollarSign, MapPin, X } from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import BookingFilters from './BookingFilters';
import BookingItem from './BookingItem';
import BookingDetails from './BookingDetails';
import { useSearchParams } from 'react-router-dom';

function UpcomingBookings() {
  // Get URL parameters for booking highlight
  const [searchParams] = useSearchParams();
  const viewBookingId = searchParams.get('view');

  // State variables
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  // Timeline view state
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'list'
  const visibleDays = 5; // Fixed number of days to show
  const [startDate, setStartDate] = useState(new Date());

  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    clientType: '',
    paymentStatus: '',
    bookingStatus: '',
  });

  // Which filters are actively applied
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [showFilters, setShowFilters] = useState(false);

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
  }, [viewBookingId, bookings]);

  // Normalize booking data
  const normalizeBookingData = useCallback((booking) => {
    const basePrice = parseFloat(booking.pricing?.basePrice || 0);
    const discount = parseFloat(booking.pricing?.discount || 0);
    const finalPrice = basePrice - discount;
    let deposit = parseFloat(booking.pricing?.deposit || 0);
    let remainingPayment = parseFloat(booking.pricing?.remainingPayment || 0);
  
    const passengers = booking.bookingDetails?.passengers;
  
    return {
      ...booking,
      clientType: booking.clientType || "Direct",
      partnerName: booking.selectedPartnerName || "",
      clientName: booking.clientDetails?.name || "N/A",
      clientPhone: booking.clientDetails?.phone || "N/A",
      clientEmail: booking.clientDetails?.email || "N/A",
      clientPassport: booking.clientDetails?.passportNumber || "N/A",
      boatCompanyName: booking.bookingDetails?.boatCompany || "N/A",
      boatName: booking.bookingDetails?.boatName || "N/A",
      numberOfPassengers: passengers === undefined || passengers === null ? undefined : parseInt(passengers, 10),
      bookingDate: booking.bookingDetails?.date || "N/A",
      startTime: booking.bookingDetails?.startTime || "N/A",
      endTime: booking.bookingDetails?.endTime || "N/A",
      basePrice,
      discount,
      finalPrice,
      deposit,
      remainingPayment,
      paymentStatus: booking.pricing?.paymentStatus || "No Payment",
      privateTransfer: booking.transfer?.required || false,
      pickupLocation: booking.transfer?.pickup?.location || "",
      dropoffLocation: booking.transfer?.dropoff?.location || "",
      pickupAddress: booking.transfer?.pickup?.address || "",
      dropoffAddress: booking.transfer?.dropoff?.address || "",
      clientNotes: booking.notes || "None",
      restaurantName: booking.restaurantName || "",
      isCancelled: booking.status === "cancelled" || false,
    };
  }, []);

  // Real-time listener setup
  useEffect(() => {
    const bookingsRef = collection(db, 'bookings');
    const q = query(bookingsRef, orderBy('bookingDetails.date', 'asc'));

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

  // Filter handlers
  const handleFilterChange = (field, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: value,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const defaultFilters = {
      dateFrom: '',
      dateTo: '',
      clientType: '',
      paymentStatus: '',
      bookingStatus: '',
    };
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  // Filter logic
  const filterBookings = () => {
    // In list mode, use the existing logic
    if (viewMode === 'list') {
      const today = new Date().toISOString().split('T')[0];
      return bookings.filter(booking => {
        if (!Object.values(appliedFilters).some(Boolean) && booking.bookingDate !== today) return false;
        
        if (appliedFilters.dateFrom && booking.bookingDate < appliedFilters.dateFrom) return false;
        if (appliedFilters.dateTo && booking.bookingDate > appliedFilters.dateTo) return false;
        if (appliedFilters.clientType && booking.clientType !== appliedFilters.clientType) return false;
        if (appliedFilters.paymentStatus && booking.paymentStatus !== appliedFilters.paymentStatus) return false;
        if (appliedFilters.bookingStatus === 'active' && booking.isCancelled) return false;
        if (appliedFilters.bookingStatus === 'cancelled' && !booking.isCancelled) return false;
        return true;
      });
    }
    
    // In timeline mode, just apply the basic filters (these will be further filtered by date)
    return bookings.filter(booking => {
      if (appliedFilters.clientType && booking.clientType !== appliedFilters.clientType) return false;
      if (appliedFilters.paymentStatus && booking.paymentStatus !== appliedFilters.paymentStatus) return false;
      if (appliedFilters.bookingStatus === 'active' && booking.isCancelled) return false;
      if (appliedFilters.bookingStatus === 'cancelled' && !booking.isCancelled) return false;
      return true;
    });
  };

  const filteredBookings = filterBookings();

  // Timeline specific functions
  // Create date array for visible days
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

  // Navigation handlers
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
    
    return filteredBookings.filter(booking => {
      return booking.bookingDate === dateString;
    });
  };

  // Format date for display
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
        restaurantName: updatedBooking.restaurantName || '',
        
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
          basePrice: updatedBooking.basePrice,
          discount: updatedBooking.discount,
          finalPrice: updatedBooking.finalPrice,
          deposit: updatedBooking.deposit,
          remainingPayment: updatedBooking.remainingPayment,
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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

  // Timeline View
  const renderTimelineView = () => {
    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-gray-600" />
            <h2 className="text-lg md:text-xl font-semibold">Upcoming Bookings</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleJumpToToday} 
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md text-sm font-medium flex items-center gap-1"
            >
              <Calendar className="h-4 w-4" />
              Today
            </button>
            
            <div className="flex items-center border rounded-md">
              <button 
                onClick={handlePreviousDays} 
                className="p-1.5 hover:bg-gray-100 border-r"
                aria-label="View previous days"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <button 
                onClick={handleNextDays} 
                className="p-1.5 hover:bg-gray-100"
                aria-label="View next days"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className={`p-1.5 rounded-md ${showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
              aria-label="Toggle filters"
            >
              <Filter className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => setViewMode('list')}
              className="px-3 py-1.5 border border-gray-300 hover:bg-gray-100 rounded-md text-sm font-medium"
            >
              List View
            </button>
          </div>
        </div>
        
        {showFilters && (
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Filter Bookings</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <BookingFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
              onApply={handleApplyFilters}
            />
          </div>
        )}
        
        <div className="space-y-6">
          {getDaysArray().map((date, index) => {
            const dateBookings = getBookingsForDate(date);
            const dateString = formatDate(date);
            
            return (
              <div key={index} className={`rounded-lg overflow-hidden ${isToday(date) ? 'border-2 border-blue-500' : 'border border-gray-200'}`}>
                <div className={`px-4 py-3 ${isToday(date) ? 'bg-blue-500 text-white' : 'bg-gray-100'} flex justify-between items-center`}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{dateString}</h3>
                    <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-white bg-opacity-20">
                      {dateBookings.length} {dateBookings.length === 1 ? 'booking' : 'bookings'}
                    </span>
                  </div>
                  
                  {dateBookings.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>
                          {dateBookings.reduce((sum, booking) => sum + (booking.numberOfPassengers || 0), 0)} passengers
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {dateBookings.length === 0 ? (
                  <div className={`p-6 text-center ${isToday(date) ? 'bg-blue-50' : 'bg-white'}`}>
                    <p className="text-gray-500">No bookings for this day</p>
                  </div>
                ) : (
                  <div className={`divide-y ${isToday(date) ? 'bg-blue-50' : 'bg-white'}`}>
                    {dateBookings.map((booking) => (
                      <div 
                        key={booking.id} 
                        id={`booking-${booking.id}`}
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleBookingSelect(booking)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium">{booking.clientName}</h4>
                            <div className="text-sm text-gray-600">{booking.clientEmail}</div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                              booking.isCancelled ? 'bg-red-100 text-red-700' :
                              booking.paymentStatus === 'Fully Paid' ? 'bg-green-100 text-green-700' :
                              booking.paymentStatus === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Ship className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{booking.boatName}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>{booking.startTime} - {booking.endTime}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="h-4 w-4 flex-shrink-0" />
                            <span>{booking.numberOfPassengers || 0} passengers</span>
                          </div>
                          
                          {booking.privateTransfer && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 md:col-span-2">
                              <MapPin className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">Transfer: {booking.pickupLocation} → {booking.dropoffLocation}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <DollarSign className="h-4 w-4 flex-shrink-0" />
                            <span>€{booking.finalPrice.toFixed(2)}</span>
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

        {/* Summary statistics */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mt-6">
          <h3 className="font-medium mb-3">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-blue-500 text-sm font-medium">Total Bookings</div>
              <div className="text-2xl font-semibold mt-1">
                {bookings.filter(b => !b.isCancelled).length}
              </div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-green-500 text-sm font-medium">Upcoming (7 days)</div>
              <div className="text-2xl font-semibold mt-1">
                {(() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  const today = new Date();
                  return bookings.filter(b => 
                    !b.isCancelled && 
                    new Date(b.bookingDate) >= today && 
                    new Date(b.bookingDate) <= nextWeek
                  ).length;
                })()}
              </div>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-yellow-500 text-sm font-medium">Pending Payments</div>
              <div className="text-2xl font-semibold mt-1">
                {bookings.filter(b => 
                  !b.isCancelled && 
                  (b.paymentStatus === 'No Payment' || b.paymentStatus === 'Partially Paid')
                ).length}
              </div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-purple-500 text-sm font-medium">Total Passengers</div>
              <div className="text-2xl font-semibold mt-1">
                {bookings
                  .filter(b => !b.isCancelled)
                  .reduce((sum, b) => sum + (b.numberOfPassengers || 0), 0)}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // List View (Original)
  const renderListView = () => {
    return (
      <>
        <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-gray-600" />
            <h2 className="text-lg md:text-xl font-semibold">Upcoming Bookings</h2>
          </div>
          
          <button
            onClick={() => setViewMode('timeline')}
            className="px-3 py-1.5 border border-gray-300 hover:bg-gray-100 rounded-md text-sm font-medium"
          >
            Timeline View
          </button>
        </div>

        <BookingFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
          onApply={handleApplyFilters}
        />

        {filteredBookings.length === 0 ? (
          <div className="text-center p-4 md:p-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No bookings match the selected filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            {filteredBookings.map((booking) => (
              <BookingItem
                key={booking.id}
                booking={booking}
                onBookingSelect={handleBookingSelect}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  // Main content
  return (
    <div className="p-4 md:p-6 space-y-4">
      {viewMode === 'timeline' ? renderTimelineView() : renderListView()}

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
