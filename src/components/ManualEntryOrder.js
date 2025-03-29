import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/firebaseConfig';
import { 
  collection, addDoc, serverTimestamp, onSnapshot, query, 
  orderBy, limit, getDocs, doc, deleteDoc, updateDoc, getDoc
} from 'firebase/firestore';
import { 
  PlusCircle, MinusCircle, Save, X, ChevronDown, Trash2, CreditCard, 
  Calendar, Search, Smartphone, Mail, User, Anchor, MapPin, Tag,
  Link as LinkIcon, AlertCircle, ArrowRight, Check, DollarSign, Package, ShoppingCart
} from 'lucide-react';

const ManualOrderEntry = ({ onClose, onOrderAdded, onOrderDeleted, initialOrderData = null }) => {
  // Prevent modal from closing when clicking inside
  const modalRef = useRef(null);
  
  // State for the form wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [formIsValid, setFormIsValid] = useState(false);
  const [showFormValidation, setShowFormValidation] = useState(false);
  
  // Base form state
  const [formData, setFormData] = useState({
    fullName: '',
    boatName: '',
    rentalCompany: '',
    phoneNumber: '',
    customerEmail: '',
    orderDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    status: 'preparing',
    items: [{ name: '', quantity: 1, price: 0 }],
    paymentType: 'fullPayment',
    amountPaid: '0', // Amount already paid by client
    hasBooking: false,
    linkedBookingId: null,
    linkedBookingDetails: null,
    orderSource: 'whatsapp',
    marina: '',
    berthNumber: ''
  });
  
  const [products, setProducts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isBookingsDropdownOpen, setIsBookingsDropdownOpen] = useState(false);
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingDateFilter, setBookingDateFilter] = useState('all');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  // Prevent form submission when pressing Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };
  
  // Initialize form with existing order data if available
  useEffect(() => {
    if (initialOrderData) {
      setFormData({
        ...initialOrderData,
        orderDate: initialOrderData.orderDate || new Date().toISOString().split('T')[0],
        items: initialOrderData.items || [{ name: '', quantity: 1, price: 0 }],
        paymentType: initialOrderData.payment_details?.paymentType || 'fullPayment',
        amountPaid: initialOrderData.payment_details?.amountPaid?.toString() || '0',
        hasBooking: !!initialOrderData.booking_info,
        linkedBookingId: initialOrderData.booking_info?.bookingId || null,
        linkedBookingDetails: initialOrderData.booking_info?.bookingDetails || null,
        orderSource: initialOrderData.orderSource || 'whatsapp'
      });
    }
  }, [initialOrderData]);
  
  // Attach document-level event listeners
  useEffect(() => {
    // Add an event listener to prevent form submission on Enter
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Fetch products and bookings from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsCollection = collection(db, 'products');
        const unsubscribe = onSnapshot(productsCollection, (snapshot) => {
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setProducts(productsData);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    
    const fetchBookings = async () => {
      try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
          bookingsRef,
          orderBy('bookingDate', 'desc'),
          limit(100)
        );
        
        const snapshot = await getDocs(q);
        const bookingsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(booking => booking.status === 'active' || !booking.status);
        
        setBookings(bookingsData);
        setFilteredBookings(bookingsData);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      }
    };
    
    fetchProducts();
    fetchBookings();
  }, []);
  
  // Filter bookings when search or date filter changes
  useEffect(() => {
    let results = [...bookings];
    
    // Apply date filter
    if (bookingDateFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      results = results.filter(booking => booking.bookingDate === today);
    } else if (bookingDateFilter === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];
      results = results.filter(booking => booking.bookingDate === tomorrowString);
    } else if (bookingDateFilter === 'upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      results = results.filter(booking => {
        if (!booking.bookingDate) return false;
        const bookingDate = new Date(booking.bookingDate);
        return bookingDate >= today;
      });
    } else if (bookingDateFilter === 'past') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      results = results.filter(booking => {
        if (!booking.bookingDate) return false;
        const bookingDate = new Date(booking.bookingDate);
        return bookingDate < today;
      });
    }
    
    // Apply search filter
    if (bookingSearchQuery.trim()) {
      const query = bookingSearchQuery.toLowerCase();
      results = results.filter(booking => 
        (booking.clientName && booking.clientName.toLowerCase().includes(query)) ||
        (booking.clientDetails?.name && booking.clientDetails.name.toLowerCase().includes(query)) ||
        (booking.bookingDetails?.boatName && booking.bookingDetails.boatName.toLowerCase().includes(query)) ||
        (booking.location && booking.location.toLowerCase().includes(query))
      );
    }
    
    setFilteredBookings(results);
  }, [bookingSearchQuery, bookingDateFilter, bookings]);
  
  // Validate form at the current step
  useEffect(() => {
    const validateCurrentStep = () => {
      switch(currentStep) {
        case 1: // Booking & Customer
          if (formData.hasBooking && !formData.linkedBookingId) {
            setFormIsValid(false);
            return;
          }
          setFormIsValid(formData.fullName.trim() !== '' && formData.boatName.trim() !== '');
          break;
        case 2: // Order items
          setFormIsValid(formData.items.length > 0 && formData.items.every(item => 
            item.name.trim() !== '' && 
            item.quantity > 0 && 
            parseFloat(item.price) >= 0)
          );
          break;
        case 3: // Payment & Finalize
          setFormIsValid(true); // Always valid as these are optional fields
          break;
        default:
          setFormIsValid(false);
      }
    };
    
    validateCurrentStep();
  }, [currentStep, formData]);
  
  // General input handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Special handler for amount field to prevent form submission and validate input
  const handleAmountChange = (e) => {
    const value = e.target.value;
    
    // Allow only numbers and a single decimal point
    if (/^(\d+)?([.])?(\d+)?$/.test(value) || value === '') {
      setFormData(prev => ({
        ...prev,
        amountPaid: value
      }));
    }
  };
  
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index][field] = value;
    
    // If selecting a product from dropdown
    if (field === 'productId' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        updatedItems[index].name = selectedProduct.name;
        updatedItems[index].price = selectedProduct.price;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      items: updatedItems
    }));
  };
  
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0 }]
    }));
  };
  
  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const updatedItems = [...formData.items];
      updatedItems.splice(index, 1);
      setFormData(prev => ({
        ...prev,
        items: updatedItems
      }));
    }
  };
  
  const calculateTotal = () => {
    return formData.items.reduce((total, item) => 
      total + (parseFloat(item.price) * parseInt(item.quantity)), 0);
  };
  
  const calculateRemainingBalance = () => {
    const total = calculateTotal();
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    return Math.max(0, total - amountPaid);
  };
  
  const linkBooking = (booking) => {
    const clientName = booking.clientName || booking.clientDetails?.name || '';
    const clientEmail = booking.clientDetails?.email || '';
    const clientPhone = booking.clientDetails?.phone || '';
    const boatName = booking.bookingDetails?.boatName || '';
    const boatCompany = booking.bookingDetails?.boatCompany || '';
    const marina = booking.location || '';
    
    setFormData(prev => ({
      ...prev,
      linkedBookingId: booking.id,
      linkedBookingDetails: {
        bookingId: booking.id.slice(-6),
        fullName: clientName,
        boatName: boatName,
        date: booking.bookingDate,
        time: `${booking.bookingDetails?.startTime || ''} - ${booking.bookingDetails?.endTime || ''}`,
        location: marina
      },
      fullName: clientName || prev.fullName,
      boatName: boatName || prev.boatName,
      rentalCompany: boatCompany || prev.rentalCompany,
      phoneNumber: clientPhone || prev.phoneNumber,
      customerEmail: clientEmail || prev.customerEmail,
      marina: marina || prev.marina,
      orderDate: booking.bookingDate || prev.orderDate
    }));
    
    setIsBookingsDropdownOpen(false);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const formatBookingTime = (booking) => {
    const startTime = booking.bookingDetails?.startTime || '';
    const endTime = booking.bookingDetails?.endTime || '';
    
    if (startTime && endTime) {
      return `${startTime} - ${endTime}`;
    } else if (booking.tourTime) {
      return booking.tourTime;
    }
    
    return 'N/A';
  };
  
  // Navigation between steps
  const goToNextStep = () => {
    if (formIsValid) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
      setShowFormValidation(false);
    } else {
      setShowFormValidation(true);
    }
  };
  
  const goToPrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setShowFormValidation(false);
  };
  
  // This function triggers the actual form submit with explicit button click
  const handleFormSubmit = (e) => {
    // Prevent form from submitting in the standard way
    if (e) e.preventDefault();
    
    if (currentStep < 3) {
      return; // Don't submit if not on the final step
    }
    
    if (!formIsValid) {
      setShowFormValidation(true);
      return;
    }
    
    submitOrder();
  };
  
  // Separated the actual submission logic
  const submitOrder = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      // Validate form
      if (!formData.fullName || !formData.boatName || formData.items.some(item => !item.name)) {
        throw new Error('Please fill in all required fields');
      }
      
      const totalAmount = calculateTotal();
      // Safely parse amount paid with handling for decimal separator
      let amountPaid = parseFloat(formData.amountPaid.replace(',', '.')) || 0;
      let amountDue = totalAmount - amountPaid;
      if (amountDue < 0) amountDue = 0;
      
      let paymentStatus = 'unpaid';
      
      if (amountPaid >= totalAmount) {
        amountPaid = totalAmount;
        amountDue = 0;
        paymentStatus = 'paid';
      } else if (amountPaid > 0) {
        paymentStatus = 'partially_paid';
      }
      
      // Determine delivery status based on the order status
      const isDelivered = ['dispatched', 'completed'].includes(formData.status);
      
      // Create order object
      const orderData = {
        fullName: formData.fullName,
        boatName: formData.boatName,
        rentalCompany: formData.rentalCompany,
        phoneNumber: formData.phoneNumber,
        customerEmail: formData.customerEmail,
        orderDate: formData.orderDate,
        status: formData.status,
        items: formData.items,
        marina: formData.marina,
        berthNumber: formData.berthNumber,
        amount_total: totalAmount,
        payment_details: {
          paymentType: formData.paymentType,
          paymentMethod: formData.paymentMethod,
          amountPaid: amountPaid,
          amountDue: amountDue
        },
        paymentStatus: paymentStatus,
        deliveryStatus: isDelivered ? 'delivered' : 'pending',
        booking_info: formData.hasBooking && formData.linkedBookingId 
          ? {
              bookingId: formData.linkedBookingId,
              bookingDetails: formData.linkedBookingDetails
            } 
          : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        orderSource: formData.orderSource,
        isManualOrder: true,
        orderId: initialOrderData?.orderId || `MAN-${Date.now().toString().substring(7)}`
      };
      
      let docRef;
      
      // Update existing order or create a new one
      if (initialOrderData?.id) {
        docRef = doc(db, 'orders', initialOrderData.id);
        await updateDoc(docRef, orderData);
      } else {
        // Add to Firestore
        docRef = await addDoc(collection(db, 'orders'), orderData);
      }
      
      // Update the linked booking if exists
      if (formData.hasBooking && formData.linkedBookingId) {
        const bookingRef = doc(db, 'bookings', formData.linkedBookingId);
        const bookingDoc = await getDoc(bookingRef);
        
        if (bookingDoc.exists()) {
          const bookingData = bookingDoc.data();
          let linkedOrders = bookingData.linkedOrders || [];
          
          // Check if this order is already linked
          const existingOrderIndex = linkedOrders.findIndex(
            order => order.orderId === orderData.orderId || 
                    order.orderDocId === (initialOrderData?.id || docRef.id)
          );
          
          // Don't use serverTimestamp() inside an array
          const orderInfo = {
            orderId: orderData.orderId,
            orderDocId: initialOrderData?.id || docRef.id,
            status: orderData.status,
            paymentStatus: orderData.paymentStatus,
            deliveryStatus: isDelivered ? 'delivered' : 'pending',
            amount: orderData.amount_total,
            items: orderData.items.map(item => ({ 
              name: item.name, 
              quantity: item.quantity 
            })),
            updatedAt: new Date().toISOString() // Use string date instead of serverTimestamp()
          };
          
          if (existingOrderIndex >= 0) {
            // Update existing order info
            linkedOrders[existingOrderIndex] = {
              ...linkedOrders[existingOrderIndex],
              ...orderInfo
            };
          } else {
            // Add new order info
            linkedOrders.push(orderInfo);
          }
          
          // Update the booking with order information
          const bookingUpdates = {
            linkedOrders: linkedOrders,
            lastUpdated: serverTimestamp() // serverTimestamp() is fine for top-level fields
          };
          
          // If order is delivered and paid, also update booking status
          if (isDelivered && paymentStatus === 'paid') {
            bookingUpdates.orderStatus = 'fulfilled';
          } else if (paymentStatus === 'paid') {
            bookingUpdates.orderStatus = 'paid';
          } else if (isDelivered) {
            bookingUpdates.orderStatus = 'delivered';
          } else {
            bookingUpdates.orderStatus = 'pending';
          }
          
          await updateDoc(bookingRef, bookingUpdates);
        }
      }
      
      setSuccess(`Order ${initialOrderData ? 'updated' : 'added'} successfully! Order ID: ${orderData.orderId}`);
      
      if (!initialOrderData) {
        setFormData({
          fullName: '',
          boatName: '',
          rentalCompany: '',
          phoneNumber: '',
          customerEmail: '',
          orderDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'cash',
          status: 'preparing',
          items: [{ name: '', quantity: 1, price: 0 }],
          paymentType: 'fullPayment',
          amountPaid: '0',
          hasBooking: false,
          linkedBookingId: null,
          linkedBookingDetails: null,
          orderSource: 'whatsapp',
          marina: '',
          berthNumber: ''
        });
      }
      
      if (onOrderAdded) {
        onOrderAdded({
          id: initialOrderData?.id || docRef.id,
          ...orderData
        });
      }
      
      // Close modal after 2 seconds
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Error with order:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Delete order function
  const handleDeleteOrder = async () => {
    if (!initialOrderData?.id) {
      setError("Cannot delete an order that hasn't been saved");
      return;
    }
    
    setIsDeleting(true);
    setError('');
    
    try {
      const orderRef = doc(db, 'orders', initialOrderData.id);
      await deleteDoc(orderRef);
      
      setSuccess('Order has been cancelled and deleted successfully');
      
      if (onOrderDeleted) {
        onOrderDeleted(initialOrderData.id);
      }
      
      // Close modal after 2 seconds
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting order:', error);
      setError(`Failed to delete order: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmation(false);
    }
  };

  // Render steps progress indicators
  const renderStepsIndicator = () => {
    return (
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center w-full max-w-3xl">
          {[
            { step: 1, label: "Customer & Booking" },
            { step: 2, label: "Order Items" },
            { step: 3, label: "Payment & Finalize" }
          ].map((item) => (
            <div key={item.step} className="flex-1 relative">
              <div 
                onClick={() => item.step < currentStep && setCurrentStep(item.step)} 
                className={`
                  flex flex-col items-center cursor-pointer
                  ${item.step < currentStep ? 'hover:opacity-80' : ''}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center mb-1
                  ${currentStep === item.step 
                    ? 'bg-blue-600 text-white' 
                    : item.step < currentStep 
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'}
                `}>
                  {item.step < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-bold">{item.step}</span>
                  )}
                </div>
                <div className={`
                  text-xs text-center
                  ${currentStep === item.step ? 'font-semibold text-blue-600' : 'text-gray-500'}
                `}>
                  {item.label}
                </div>
              </div>
              
              {item.step < 3 && (
                <div className={`
                  absolute top-5 left-[calc(50%+20px)] right-[calc(50%-20px)] h-0.5
                  ${currentStep > item.step ? 'bg-green-500' : 'bg-gray-200'}
                `} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render step 1: Booking & Customer Details
  const renderStep1 = () => {
    return (
      <div className="space-y-6">
        {/* Booking Selection - Prominently at the top */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <LinkIcon className="h-5 w-5 text-blue-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-800">Link to Existing Booking</h3>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasBooking}
                onChange={() => {
                  setFormData(prev => ({
                    ...prev, 
                    hasBooking: !prev.hasBooking,
                    linkedBookingId: null,
                    linkedBookingDetails: null
                  }));
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-600">Enable booking link</span>
            </label>
          </div>
          
          {formData.hasBooking && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={bookingSearchQuery}
                    onChange={(e) => setBookingSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <select
                  value={bookingDateFilter}
                  onChange={(e) => setBookingDateFilter(e.target.value)}
                  className="w-full sm:w-auto rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All dates</option>
                  <option value="today">Today</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
              </div>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsBookingsDropdownOpen(!isBookingsDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="truncate">
                    {formData.linkedBookingId 
                      ? `${formData.linkedBookingDetails.fullName} - ${formData.linkedBookingDetails.boatName}` 
                      : 'Select a booking'}
                  </span>
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </button>
                
                {isBookingsDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredBookings.length > 0 ? (
                      filteredBookings.map(booking => (
                        <div 
                          key={booking.id}
                          className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => linkBooking(booking)}
                        >
                          <div className="font-medium text-gray-800">
                            {booking.clientName || booking.clientDetails?.name || 'Unknown'} - {formatDate(booking.bookingDate)}
                          </div>
                          <div className="text-sm text-gray-600 mt-0.5">
                            {booking.bookingDetails?.boatName || booking.tourType || 'Unknown Boat'} 
                            {booking.location ? ` • ${booking.location}` : ''} 
                            {` • ${formatBookingTime(booking)}`}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-gray-500 text-center">No bookings match your search</div>
                    )}
                  </div>
                )}
              </div>
              
              {formData.linkedBookingId && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-blue-800">Booking #{formData.linkedBookingDetails.bookingId}</div>
                      <div className="text-sm text-blue-700 mt-1">
                        {formData.linkedBookingDetails.fullName} • {formData.linkedBookingDetails.boatName}<br />
                        {formatDate(formData.linkedBookingDetails.date)} • {formData.linkedBookingDetails.time || 'N/A'} • {formData.linkedBookingDetails.location || 'N/A'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev, 
                        linkedBookingId: null,
                        linkedBookingDetails: null
                      }))}
                      className="text-blue-600 hover:text-blue-800 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {formData.hasBooking && !formData.linkedBookingId && showFormValidation && (
                <div className="text-sm text-red-600 mt-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Please select a booking or disable booking link
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Customer Info Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <User className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-800">Customer & Boat Details</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Customer Name*
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className={`
                      pl-10 w-full rounded-lg border shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500
                      ${showFormValidation && !formData.fullName.trim() 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300'}
                    `}
                    required
                  />
                </div>
                {showFormValidation && !formData.fullName.trim() && (
                  <p className="text-sm text-red-600 mt-1">Customer name is required</p>
                )}
              </div>
              
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Smartphone className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="pl-10 w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="pl-10 w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Boat Name*
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Anchor className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="boatName"
                    value={formData.boatName}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className={`
                      pl-10 w-full rounded-lg border shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500
                      ${showFormValidation && !formData.boatName.trim() 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300'}
                    `}
                    required
                  />
                </div>
                {showFormValidation && !formData.boatName.trim() && (
                  <p className="text-sm text-red-600 mt-1">Boat name is required</p>
                )}
              </div>
              
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Rental Company
                </label>
                <input
                  type="text"
                  name="rentalCompany"
                  value={formData.rentalCompany}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Marina/Location
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="marina"
                    value={formData.marina}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="pl-10 w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Marina Ibiza"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                Order Date*
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="date"
                  name="orderDate"
                  value={formData.orderDate}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="pl-10 w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                Berth Number
              </label>
              <input
                type="text"
                name="berthNumber"
                value={formData.berthNumber}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. B-12"
              />
            </div>
          </div>
        </div>
        
        {/* Order Source */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <Smartphone className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-800">Order Source</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="h-4 w-4" /> },
              { id: 'phone', label: 'Phone', icon: <Smartphone className="h-4 w-4" /> },
              { id: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
              { id: 'in-person', label: 'In Person', icon: <User className="h-4 w-4" /> }
            ].map(source => (
              <label
                key={source.id}
                className={`
                  flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer
                  ${formData.orderSource === source.id 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <input
                  type="radio"
                  name="orderSource"
                  value={source.id}
                  checked={formData.orderSource === source.id}
                  onChange={() => setFormData(prev => ({...prev, orderSource: source.id}))}
                  className="sr-only"
                />
                <div className="flex flex-col items-center text-center">
                  {source.icon}
                  <span className="mt-1 text-sm">{source.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  // Render step 2: Order Items
  const renderStep2 = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <ShoppingCart className="h-5 w-5 text-blue-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-800">Order Items</h3>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-full hover:bg-blue-700"
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Add Item
            </button>
          </div>
          
          {showFormValidation && formData.items.some(item => !item.name.trim()) && (
            <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm">Please fill in all item fields with a product name and valid quantity/price</p>
            </div>
          )}
          
          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div 
                key={index} 
                className={`
                  p-3 border rounded-lg transition-colors
                  ${showFormValidation && !item.name.trim() 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Package className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">Item {index + 1}</span>
                    </div>
                    
                    <select
                      value={item.productId || ''}
                      onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                      className={`
                        w-full rounded-lg border shadow-sm py-2 mt-2 focus:ring-2 focus:ring-blue-500
                        ${showFormValidation && !item.name.trim() 
                          ? 'border-red-300 bg-red-50' 
                          : 'border-gray-300'}
                      `}
                    >
                      <option value="">Select product or enter custom name</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - €{product.price?.toFixed(2)}
                        </option>
                      ))}
                    </select>
                    
                    {!item.productId && (
                      <input
                        type="text"
                        placeholder="Custom item name"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`
                          w-full rounded-lg border shadow-sm py-2 mt-2 focus:ring-2 focus:ring-blue-500
                          ${showFormValidation && !item.name.trim() 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300'}
                        `}
                        required
                      />
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="ml-2 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50"
                    disabled={formData.items.length === 1}
                  >
                    <MinusCircle className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-1/3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.quantity}
                      onKeyDown={handleKeyDown}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow only numbers
                        if (/^\d*$/.test(value) || value === '') {
                          handleItemChange(index, 'quantity', parseInt(value) || 1);
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 shadow-sm py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div className="w-1/3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price (€)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500">€</span>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.price}
                        onKeyDown={handleKeyDown}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow only numbers and a single decimal point
                          if (/^(\d+)?([.])?(\d+)?$/.test(value) || value === '') {
                            handleItemChange(index, 'price', parseFloat(value) || 0);
                          }
                        }}
                        className="pl-7 w-full rounded-lg border border-gray-300 shadow-sm py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="w-1/3 text-right">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                    <div className="py-1.5 font-medium text-blue-700">
                      €{(parseFloat(item.price) * parseInt(item.quantity)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
            <div>
              <div className="text-sm text-blue-700">Order Total</div>
              <div className="text-xl font-bold text-blue-800">€{calculateTotal().toFixed(2)}</div>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Another Item
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render step 3: Payment & Finalize
  const renderStep3 = () => {
    return (
      <div className="space-y-6">
        {/* Payment Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-800">Payment Details</h3>
          </div>
          
          <div className="space-y-5">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'cash', label: 'Cash', icon: <CreditCard className="h-4 w-4" /> },
                  { id: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
                  { id: 'transfer', label: 'Transfer', icon: <CreditCard className="h-4 w-4" /> },
                  { id: 'unpaid', label: 'Unpaid', icon: <Tag className="h-4 w-4" /> }
                ].map(method => (
                  <label
                    key={method.id}
                    className={`
                      flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors
                      ${formData.paymentMethod === method.id 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300'}
                    `}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={formData.paymentMethod === method.id}
                      onChange={() => setFormData(prev => ({...prev, paymentMethod: method.id}))}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center">
                      {method.icon}
                      <span className="mt-1 text-sm">{method.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                Amount Paid (€)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">€</span>
                </div>
                {/* SPECIALIZED AMOUNT INPUT */}
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.amountPaid}
                  onChange={handleAmountChange}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    // Prevent form submission on Enter
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  className="pl-8 w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">€{calculateTotal().toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="text-green-600">€{parseFloat(formData.amountPaid || 0).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center font-medium mt-2 pt-2 border-t border-gray-200">
                <span>Remaining Balance:</span>
                <span className={calculateRemainingBalance() > 0 ? "text-red-600" : "text-green-600"}>
                  €{calculateRemainingBalance().toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                Order Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 shadow-sm py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="preparing">Preparing</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="dispatched">Dispatched</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-medium mb-3 text-gray-800">Order Summary</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Customer Information</h4>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">{formData.fullName}</div>
                  {formData.phoneNumber && <div className="text-sm text-gray-600">Phone: {formData.phoneNumber}</div>}
                  {formData.customerEmail && <div className="text-sm text-gray-600">Email: {formData.customerEmail}</div>}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Boat & Location</h4>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">{formData.boatName}</div>
                  {formData.rentalCompany && <div className="text-sm text-gray-600">Company: {formData.rentalCompany}</div>}
                  {formData.marina && <div className="text-sm text-gray-600">Marina: {formData.marina}</div>}
                  {formData.berthNumber && <div className="text-sm text-gray-600">Berth: {formData.berthNumber}</div>}
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-1">Order Items</h4>
              <div className="border-t border-b border-gray-200 py-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex justify-between py-2">
                    <div>
                      <span className="font-medium">{item.name || 'Unnamed item'}</span>
                      <span className="text-gray-600 ml-2">x{item.quantity}</span>
                    </div>
                    <span>€{(parseFloat(item.price) * parseInt(item.quantity)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center py-3 font-semibold">
                <span>Total Amount:</span>
                <span>€{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
            
            {formData.hasBooking && formData.linkedBookingId && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Linked Booking</h4>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="font-medium">Booking #{formData.linkedBookingDetails.bookingId}</div>
                  <div className="text-sm text-blue-700">
                    Date: {formatDate(formData.linkedBookingDetails.date)} •
                    Time: {formData.linkedBookingDetails.time || 'N/A'}
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Order Date: {formatDate(formData.orderDate)}</span>
              </div>
              <div className="flex items-center mt-2 text-sm text-gray-500">
                <Tag className="h-4 w-4 mr-2" />
                <span>Order Status: 
                  <span className={`
                    ml-1 px-2 py-0.5 rounded-full text-xs font-medium 
                    ${formData.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      formData.status === 'dispatched' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'}
                  `}>
                    {formData.status.charAt(0).toUpperCase() + formData.status.slice(1).replace('_', ' ')}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the current step
  const renderCurrentStep = () => {
    switch(currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      default: return renderStep1();
    }
  };
  
  // Prevent clicks on modal from bubbling up to close the modal
  const handleModalClick = (e) => {
    e.stopPropagation();
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-black bg-opacity-50">
      <div 
        ref={modalRef}
        className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:w-4xl md:rounded-xl overflow-hidden flex flex-col"
        onClick={handleModalClick}
      >
        {/* Header with sticky positioning */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-xl font-bold text-gray-800">
              {initialOrderData ? 'Edit Order' : 'New Order'}
            </h2>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Order total display visible on both tabs */}
          <div className="flex justify-between items-center px-4 py-2 bg-blue-50 border-t border-blue-100">
            <div className="flex items-center">
              <span className="text-blue-700 font-medium mr-2">Total:</span>
              <span className="text-lg font-bold text-blue-800">€{calculateTotal().toFixed(2)}</span>
            </div>
            
            {initialOrderData && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirmation(true)}
                className="flex items-center text-red-600 hover:text-red-800 px-3 py-1 rounded-full hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                <span>Cancel Order</span>
              </button>
            )}
          </div>
          
          {/* Notification area */}
          {(error || success) && (
            <div className={`px-4 py-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {error || success}
            </div>
          )}
        </div>
        
        {/* Form Wizard Content */}
        <form 
          onSubmit={(e) => {
            e.preventDefault(); // Prevent default browser form submission
            return false; // Additionally return false to be extra safe
          }} 
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Steps Indicator */}
            {renderStepsIndicator()}
            
            {/* Current Step Content */}
            {renderCurrentStep()}
          </div>
          
          {/* Bottom action bar with navigation buttons */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 mt-auto">
            <div className="flex justify-between">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={goToPrevStep}
                    className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex items-center"
                  >
                    Previous
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center"
                  >
                    Next <ArrowRight className="ml-2 w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button" // Not submit
                    onClick={handleFormSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium inline-flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1.5" />
                        {initialOrderData ? 'Update Order' : 'Complete Order'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <div className="text-center mb-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Order</h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to cancel and delete this order? This action cannot be undone.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmation(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  No, Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOrder}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium inline-flex items-center justify-center"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Yes, Cancel Order'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualOrderEntry;