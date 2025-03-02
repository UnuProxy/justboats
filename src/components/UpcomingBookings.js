import React, { useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
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
  }, [viewBookingId]);

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
  };

  const filteredBookings = filterBookings();

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

  // Main content
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4 md:mb-6">
        <Calendar className="h-6 w-6 text-gray-600" />
        <h2 className="text-lg md:text-xl font-semibold">Upcoming Bookings</h2>
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
