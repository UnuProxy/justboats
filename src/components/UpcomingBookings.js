import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Ship, Clock, Users, Euro, MapPin, X, Home, 
  BarChart3, List, Calendar as CalendarIcon, PieChart, Search, SlidersHorizontal, 
  Rows3, Table2 } from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy as firestoreOrderBy,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import BookingDetails from './BookingDetails';
import { useSearchParams } from 'react-router-dom';

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
  
  // Views: timeline, list, grid, table
  const [viewMode, setViewMode] = useState('timeline'); // Set timeline as default
  const visibleDays = 5; // Fixed number of days to show
  const [startDate, setStartDate] = useState(new Date());
  
  // Enhancement for handling many bookings
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  const [compactView, setCompactView] = useState(false);
  
  // Fixed sorting values (no longer state variables)
  const sortField = 'bookingDate';
  const sortDirection = 'asc';
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [bookingsPerPage, setBookingsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter state - simplified
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    clientType: '',
    paymentStatus: '',
    bookingStatus: '',
  });

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
  }, [viewBookingId, filteredBookings, currentPage]);

  // Normalize booking data
  const normalizeBookingData = useCallback((booking) => {
    const basePrice = parseFloat(booking.pricing?.basePrice || 0);
    const discount = parseFloat(booking.pricing?.discount || 0);
    const finalPrice = parseFloat(booking.pricing?.agreedPrice || 0) || (basePrice - discount);
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
  }, []);

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

  // Filter handlers
  const handleFilterChange = (field, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: value,
    }));
    // Reset to page 1 when filters change
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to page 1 when search changes
  };

  const handleQuickFilterChange = (filter) => {
    setQuickFilter(filter);
    setCurrentPage(1); // Reset to page 1 when quick filter changes
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
    setSearchQuery('');
    setQuickFilter('all');
    setCurrentPage(1);
  };

  // Apply all filters and sorting
  useEffect(() => {
    // Step 1: Apply standard filters
    let filtered = bookings.filter(booking => {
      if (filters.dateFrom && booking.bookingDate < filters.dateFrom) return false;
      if (filters.dateTo && booking.bookingDate > filters.dateTo) return false;
      if (filters.clientType && booking.clientType !== filters.clientType) return false;
      if (filters.paymentStatus && booking.paymentStatus !== filters.paymentStatus) return false;
      if (filters.bookingStatus === 'active' && booking.isCancelled) return false;
      if (filters.bookingStatus === 'cancelled' && !booking.isCancelled) return false;
      return true;
    });
    
    // Step 2: Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(booking => 
        booking.clientName.toLowerCase().includes(query) ||
        booking.boatName.toLowerCase().includes(query) ||
        booking.clientEmail.toLowerCase().includes(query) ||
        booking.boatCompanyName.toLowerCase().includes(query) ||
        (booking.restaurantName && booking.restaurantName.toLowerCase().includes(query))
      );
    }
    
    // Step 3: Apply quick filter
    if (quickFilter !== 'all') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (quickFilter === 'today') {
        filtered = filtered.filter(b => b.bookingDate === todayStr);
      } else if (quickFilter === 'week') {
        const weekLater = new Date();
        weekLater.setDate(today.getDate() + 7);
        filtered = filtered.filter(b => {
          const bookingDate = new Date(b.bookingDate);
          return bookingDate >= today && bookingDate <= weekLater;
        });
      } else if (quickFilter === 'month') {
        const monthLater = new Date();
        monthLater.setMonth(today.getMonth() + 1);
        filtered = filtered.filter(b => {
          const bookingDate = new Date(b.bookingDate);
          return bookingDate >= today && bookingDate <= monthLater;
        });
      } else if (quickFilter === 'past') {
        filtered = filtered.filter(b => {
          const bookingDate = new Date(b.bookingDate);
          return bookingDate < today;
        });
      }
    }
    
    // Step 4: Apply sorting (using fixed sort values)
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'clientName':
          comparison = a.clientName.localeCompare(b.clientName);
          break;
        case 'bookingDate':
          comparison = new Date(a.bookingDate) - new Date(b.bookingDate);
          break;
        case 'finalPrice':
          comparison = a.finalPrice - b.finalPrice;
          break;
        case 'boatName':
          comparison = a.boatName.localeCompare(b.boatName);
          break;
        case 'paymentStatus':
          comparison = a.paymentStatus.localeCompare(b.paymentStatus);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Calculate total pages
    setTotalPages(Math.ceil(filtered.length / bookingsPerPage));
    
    // Update filtered bookings
    setFilteredBookings(filtered);
  }, [bookings, filters, searchQuery, quickFilter, sortField, sortDirection, bookingsPerPage]);

  // Get paginated bookings
  const paginatedBookings = useMemo(() => {
    const indexOfLastBooking = currentPage * bookingsPerPage;
    const indexOfFirstBooking = indexOfLastBooking - bookingsPerPage;
    return filteredBookings.slice(indexOfFirstBooking, indexOfLastBooking);
  }, [filteredBookings, currentPage, bookingsPerPage]);

  // Timeline specific functions
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
    setQuickFilter('today');
  };

  // Get bookings for a specific date
  const getBookingsForDate = (date) => {
    const dateString = formatDateForComparison(date);
    return filteredBookings.filter(booking => booking.bookingDate === dateString);
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

  // Calculate key stats
  const getKeyStats = () => {
    const activeBookings = bookings.filter(b => !b.isCancelled);
    const upcomingWeekBookings = activeBookings.filter(b => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const today = new Date();
      const bookingDate = new Date(b.bookingDate);
      return bookingDate >= today && bookingDate <= nextWeek;
    });
    
    const pendingPayments = activeBookings.filter(b => 
      b.paymentStatus === 'No Payment' || b.paymentStatus === 'Partial'
    );
    
    const totalPassengers = activeBookings.reduce((sum, b) => sum + (b.numberOfPassengers || 0), 0);
    
    const totalRevenue = activeBookings.reduce((sum, b) => sum + b.finalPrice, 0);
    
    return {
      totalBookings: activeBookings.length,
      upcomingWeek: upcomingWeekBookings.length,
      pendingPayments: pendingPayments.length,
      totalPassengers,
      totalRevenue
    };
  };
  
  // Loading state
  if (loading) {
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

  // Get stats for the dashboard
  const stats = getKeyStats();

  // Pagination Controls Component
  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    
    // Calculate which page numbers to show
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if there are 5 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Show a window of pages centered around the current page
      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      
      // Adjust start page if we're near the end
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add first and last page if they're not already included
      if (startPage > 1) {
        pageNumbers.unshift(1);
        if (startPage > 2) pageNumbers.splice(1, 0, '...');
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    const indexOfFirstBooking = (currentPage - 1) * bookingsPerPage + 1;
    const indexOfLastBooking = Math.min(currentPage * bookingsPerPage, filteredBookings.length);
    
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 p-3 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="text-sm text-gray-600">
          Showing <span className="font-medium">{indexOfFirstBooking}-{indexOfLastBooking}</span> of <span className="font-medium">{filteredBookings.length}</span> bookings
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded border border-gray-300 bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &laquo;
          </button>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded border border-gray-300 bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &lsaquo;
          </button>
          
          {pageNumbers.map((page, index) => (
            page === '...' ? (
              <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500">...</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
                  currentPage === page 
                    ? 'bg-blue-500 text-white border border-blue-500' 
                    : 'border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            )
          ))}
          
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded border border-gray-300 bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &rsaquo;
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded border border-gray-300 bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &raquo;
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show</span>
          <select 
            value={bookingsPerPage}
            onChange={(e) => {
              setBookingsPerPage(Number(e.target.value));
              setCurrentPage(1); // Reset to page 1 when changing page size
            }}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-600">per page</span>
        </div>
      </div>
    );
  };


  const FilterToolbar = () => {
    const [showFilters, setShowFilters] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    return (
      <div className="bg-white p-3 rounded-xl shadow-md mb-4">
        {/* Search Input - Always visible */}
        <div className="relative w-full mb-2">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search client, boat, email..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        
        {/* Toggle Filters Button */}
        <div className="flex items-center justify-between mb-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-blue-600 text-sm font-medium"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
          </button>
          
          {/* Clear Button - Only show if filters are active */}
          {(filters.dateFrom || filters.dateTo || searchQuery || quickFilter !== 'all') && (
            <button 
              onClick={handleClearFilters}
              className="text-gray-500 text-sm"
            >
              Clear All
            </button>
          )}
        </div>
        
        {/* Quick Filter Pills - Horizontal scrollable on mobile */}
        <div className="flex overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex gap-2 flex-nowrap">
            <button 
              onClick={() => handleQuickFilterChange('all')}
              className={`px-3 py-1.5 rounded-lg border whitespace-nowrap text-sm font-medium ${
                quickFilter === 'all' 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            
            <button
              onClick={() => {
                setShowDatePicker(!showDatePicker);
                setShowFilters(true);
              }}
              className={`px-3 py-1.5 rounded-lg border whitespace-nowrap text-sm font-medium flex items-center gap-1 ${
                filters.dateFrom || filters.dateTo || showDatePicker
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Date Range</span>
            </button>
          </div>
        </div>
        
        {/* Extended Filters - Only shown when expanded */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            {/* Date Range Picker */}
            {showDatePicker && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="block w-full border border-gray-300 rounded-md text-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="block w-full border border-gray-300 rounded-md text-sm p-2"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Hide scrollbar with CSS inline styles instead of JSX styles */}
      </div>
    );
  };

  // Stats Dashboard Component
  const StatsDashboard = () => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-md text-white">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{stats.totalBookings}</div>
          <Calendar className="h-8 w-8 opacity-80" />
        </div>
        <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Active Bookings</div>
      </div>
      
      <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-md text-white">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{stats.upcomingWeek}</div>
          <CalendarIcon className="h-8 w-8 opacity-80" />
        </div>
        <div className="text-xs uppercase tracking-wide mt-1 opacity-80">This Week</div>
      </div>
      
      <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 rounded-xl shadow-md text-white">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{stats.pendingPayments}</div>
          <BarChart3 className="h-8 w-8 opacity-80" />
        </div>
        <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Pending Payments</div>
      </div>
      
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-md text-white">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{stats.totalPassengers}</div>
          <Users className="h-8 w-8 opacity-80" />
        </div>
        <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Total Passengers</div>
      </div>
      
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl shadow-md text-white">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">€{stats.totalRevenue.toFixed(0)}</div>
          <Euro className="h-8 w-8 opacity-80" />
        </div>
        <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Total Revenue</div>
      </div>
    </div>
  );
  
  // View Mode Header
  // Optimized ViewModeHeader for desktop and mobile
const ViewModeHeader = () => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 bg-white p-3 sm:p-4 rounded-xl shadow-md">
    <div className="flex items-center gap-2">
      <div className="bg-blue-100 p-2 rounded-lg">
        {viewMode === 'timeline' && <Calendar className="h-5 w-5 text-blue-600" />}
        {viewMode === 'list' && <List className="h-5 w-5 text-blue-600" />}
        {viewMode === 'grid' && <BarChart3 className="h-5 w-5 text-blue-600" />}
        {viewMode === 'table' && <Table2 className="h-5 w-5 text-blue-600" />}
      </div>
      <div>
        <h2 className="text-base sm:text-lg font-semibold">
          {viewMode === 'timeline' && 'Booking Timeline'}
          {viewMode === 'list' && 'Booking List'}
          {viewMode === 'grid' && 'Booking Grid'}
          {viewMode === 'table' && 'Booking Table'}
        </h2>
        <span className="text-xs sm:text-sm text-gray-500">
          {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'}
        </span>
      </div>
    </div>
    
    <div className="flex items-center gap-2 mt-2 sm:mt-0">
      {viewMode === 'timeline' && (
        <>
          <button 
            onClick={handleJumpToToday} 
            className="px-2 sm:px-3 py-1 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Today</span>
          </button>
          
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button 
              onClick={handlePreviousDays} 
              className="p-1.5 sm:p-2 hover:bg-gray-100 border-r transition-colors"
              aria-label="View previous days"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button 
              onClick={handleNextDays} 
              className="p-1.5 sm:p-2 hover:bg-gray-100 transition-colors"
              aria-label="View next days"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </>
      )}
      
      {(viewMode === 'list' || viewMode === 'table') && (
        <button
          onClick={() => setCompactView(!compactView)}
          className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
            compactView ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
          title={compactView ? 'Switch to normal view' : 'Switch to compact view'}
        >
          {compactView ? <List className="h-5 w-5" /> : <Rows3 className="h-5 w-5" />}
        </button>
      )}
      
      <div className="bg-gray-100 p-1 rounded-lg flex">
        <button
          onClick={() => setViewMode('timeline')}
          className={`p-1.5 rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          aria-label="Timeline view"
          title="Timeline view"
        >
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          aria-label="List view"
          title="List view"
        >
          <List className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          aria-label="Grid view"
          title="Grid view"
        >
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          aria-label="Table view"
          title="Table view"
        >
          <Table2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>
    </div>
  </div>
);

  // Timeline View
  const renderTimelineView = () => {
    return (
      <>
        <ViewModeHeader />
        <FilterToolbar />
        
        <div className="space-y-6">
          {getDaysArray().map((date, index) => {
            const dateBookings = getBookingsForDate(date);
            const dateString = formatDate(date);
            
            return (
              <div key={index} className={`rounded-xl overflow-hidden shadow-md ${isToday(date) ? 'ring-2 ring-blue-500' : ''}`}>
                <div className={`px-4 py-3 ${isToday(date) ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' : 'bg-gradient-to-r from-gray-100 to-gray-200'} flex justify-between items-center`}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{dateString}</h3>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${isToday(date) ? 'bg-white bg-opacity-20' : 'bg-blue-100 text-blue-800'}`}>
                      {dateBookings.length} {dateBookings.length === 1 ? 'booking' : 'bookings'}
                    </span>
                  </div>
                  
                  {dateBookings.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
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
                
                {dateBookings.length === 0 ? (
                  <div className={`p-6 text-center ${isToday(date) ? 'bg-blue-50' : 'bg-white'}`}>
                    <p className="text-gray-500">No bookings for this day</p>
                  </div>
                ) : (
                  <div className={`grid gap-3 p-3 ${isToday(date) ? 'bg-blue-50' : 'bg-white'}`}>
                    {dateBookings.map((booking) => (
                      <div 
                        key={booking.id} 
                        id={`booking-${booking.id}`}
                        className="p-4 bg-white hover:bg-gray-50 transition-all cursor-pointer rounded-lg border border-gray-200 shadow-sm hover:shadow-md transform hover:-translate-y-1"
                        onClick={() => handleBookingSelect(booking)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <h4 className="font-medium text-gray-900">{booking.clientName}</h4>
                              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                booking.clientType === 'Direct' ? 'bg-blue-100 text-blue-700' :
                                booking.clientType === 'Hotel' ? 'bg-purple-100 text-purple-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {booking.clientType}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-0.5">{booking.clientEmail || booking.clientPhone}</div>
                          </div>
                          
                          <div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              booking.isCancelled ? 'bg-red-100 text-red-700' :
                              booking.paymentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                              booking.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="bg-blue-100 p-1 rounded-md">
                              <Ship className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="truncate font-medium">{booking.boatName}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="bg-green-100 p-1 rounded-md">
                              <Clock className="h-4 w-4 text-green-600" />
                            </div>
                            <span>{booking.startTime} - {booking.endTime}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="bg-purple-100 p-1 rounded-md">
                              <Users className="h-4 w-4 text-purple-600" />
                            </div>
                            <span>{booking.numberOfPassengers || 0} passengers</span>
                          </div>
                          
                          {booking.privateTransfer && (
                            <div className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                              <div className="bg-yellow-100 p-1 rounded-md">
                                <MapPin className="h-4 w-4 text-yellow-600" />
                              </div>
                              <span className="truncate">Transfer: {booking.pickupLocation} → {booking.dropoffLocation}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <div className="bg-indigo-100 p-1 rounded-md">
                              <Euro className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="text-gray-900">€{booking.finalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        {booking.restaurantName && (
                          <div className="mt-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <div className="bg-red-100 p-1 rounded-md">
                                <Home className="h-4 w-4 text-red-600" />
                              </div>
                              <span>Restaurant: {booking.restaurantName}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <PaginationControls />
        
        {/* Stats Dashboard at bottom */}
        <StatsDashboard />
      </>
    );
  };

  // List View
  const renderListView = () => {
    return (
      <>
        <ViewModeHeader />
        <FilterToolbar />
        
        {filteredBookings.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-xl shadow-md">
            <PieChart className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-600">No bookings match the selected filters</p>
            <button
              onClick={handleClearFilters}
              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {/* Table Header */}
            {compactView && (
              <div className="grid grid-cols-5 gap-3 px-4 py-2 bg-gray-100 border-b text-xs font-medium text-gray-600 uppercase">
                <div>Client</div>
                <div>Boat</div>
                <div>Time</div>
                <div>Passengers</div>
                <div className="text-right">Price</div>
              </div>
            )}
            
            {/* Bookings List */}
            <div className="divide-y">
              {paginatedBookings.map((booking) => (
                <div 
                  key={booking.id}
                  id={`booking-${booking.id}`}
                  onClick={() => handleBookingSelect(booking)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                    compactView 
                      ? 'py-3 px-4 grid grid-cols-5 gap-3 items-center' 
                      : 'p-4'
                  }`}
                >
                  {compactView ? (
                    <>
                      <div className="truncate">
                        <div className="font-medium">{booking.clientName}</div>
                        <div className="text-xs text-gray-500">{booking.bookingDate}</div>
                      </div>
                      <div className="truncate text-sm">{booking.boatName}</div>
                      <div className="text-sm">{booking.startTime}</div>
                      <div className="text-sm">{booking.numberOfPassengers} pax</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">€{booking.finalPrice.toFixed(0)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          booking.isCancelled ? 'bg-red-100 text-red-700' :
                          booking.paymentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                          booking.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                        </span>
                      </div>
                    </>
                  ) : (
                    // Regular detailed view
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{booking.clientName}</h4>
                            <span className="text-sm text-gray-500">{booking.bookingDate}</span>
                          </div>
                          <div className="text-sm text-gray-600">{booking.clientEmail || booking.clientPhone}</div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.clientType === 'Direct' ? 'bg-blue-100 text-blue-700' :
                            booking.clientType === 'Hotel' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {booking.clientType}
                          </span>
                          
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.isCancelled ? 'bg-red-100 text-red-700' :
                            booking.paymentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                            booking.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Ship className="h-4 w-4 text-blue-500" />
                          <span className="truncate">{booking.boatName}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-4 w-4 text-green-500" />
                          <span>{booking.startTime} - {booking.endTime}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span>{booking.numberOfPassengers || 0} passengers</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Euro className="h-4 w-4 text-indigo-500" />
                          <span>€{booking.finalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      {(booking.privateTransfer || booking.restaurantName) && (
                        <div className="flex flex-wrap gap-3 mt-2">
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
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <PaginationControls />
        
        {/* Stats Dashboard at bottom */}
        <StatsDashboard />
      </>
    );
  };
  
  // Grid View
  const renderGridView = () => {
    return (
      <>
        <ViewModeHeader />
        <FilterToolbar />
        
        {filteredBookings.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-xl shadow-md">
            <PieChart className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-600">No bookings match the selected filters</p>
            <button
              onClick={handleClearFilters}
              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {paginatedBookings.map((booking) => (
              <div 
                key={booking.id}
                id={`booking-${booking.id}`}
                className="bg-white rounded-xl shadow-md p-4 cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-1"
                onClick={() => handleBookingSelect(booking)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm text-gray-500">{booking.bookingDate}</span>
                    <h3 className="font-semibold text-lg mt-0.5">{booking.clientName}</h3>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    booking.isCancelled ? 'bg-red-100 text-red-700' :
                    booking.paymentStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                    booking.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                  </span>
                </div>
                
                <div className="border-t border-gray-100 mt-3 pt-3 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-1 rounded-md">
                      <Ship className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm truncate">{booking.boatName}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-1 rounded-md">
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-sm">{booking.numberOfPassengers} pax</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="bg-green-100 p-1 rounded-md">
                      <Clock className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm">{booking.startTime} - {booking.endTime}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-100 p-1 rounded-md">
                      <Euro className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium">€{booking.finalPrice.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    booking.clientType === 'Direct' ? 'bg-blue-100 text-blue-700' :
                    booking.clientType === 'Hotel' ? 'bg-purple-100 text-purple-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {booking.clientType}
                  </span>
                  
                  {booking.privateTransfer && (
                    <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full text-xs">
                      Transfer
                    </span>
                  )}
                  
                  {booking.restaurantName && (
                    <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs">
                      Restaurant
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <PaginationControls />
        
        {/* Stats Dashboard at bottom */}
        <StatsDashboard />
      </>
    );
  };
  
  // Table View
  const renderTableView = () => {
    return (
      <>
        <ViewModeHeader />
        <FilterToolbar />
        
        {filteredBookings.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-xl shadow-md">
            <PieChart className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-600">No bookings match the selected filters</p>
            <button
              onClick={handleClearFilters}
              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Boat
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pax
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Extras
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedBookings.map((booking) => (
                  <tr 
                    key={booking.id}
                    id={`booking-${booking.id}`}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleBookingSelect(booking)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {booking.bookingDate}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{booking.clientName}</div>
                          <div className="text-xs text-gray-500">{booking.clientType}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {booking.boatName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {booking.startTime} - {booking.endTime}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {booking.numberOfPassengers}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      €{booking.finalPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        booking.isCancelled ? 'bg-red-100 text-red-800' :
                        booking.paymentStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                        booking.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.isCancelled ? 'Cancelled' : booking.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-1">
                        {booking.privateTransfer && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            <MapPin className="h-3 w-3 mr-1" />
                            Transfer
                          </span>
                        )}
                        {booking.restaurantName && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <Home className="h-3 w-3 mr-1" />
                            Restaurant
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <PaginationControls />
        
        {/* Stats Dashboard at bottom */}
        <StatsDashboard />
      </>
    );
  };

  // Main content
  return (
    <div className="p-4 md:p-6 space-y-4 bg-gray-50 min-h-screen">
      {viewMode === 'timeline' && renderTimelineView()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'grid' && renderGridView()}
      {viewMode === 'table' && renderTableView()}

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
