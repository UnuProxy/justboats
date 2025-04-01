import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { formatDateDDMMYYYY, formatDateTime } from "../utils/date.js";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { format } from "date-fns";
import { db } from "../firebase/firebaseConfig";
import PaymentDetails from "./PaymentDetails.js";
import { useNavigate } from 'react-router-dom';

const BookingDetails = ({ booking, onClose, onDelete }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const modalRef = useRef(null);  
  const [linkedExpenses, setLinkedExpenses] = useState([]);
  const [editedBooking, setEditedBooking] = useState(() => {
    console.log("Raw booking data:", booking);
    
    // Only change is here - ensure payments is always an array
    const payments = Array.isArray(booking?.payments) ? booking.payments : 
                     Array.isArray(booking?.pricing?.payments) ? booking.pricing.payments : [];
    
    const firstPayment = payments.find(p => p.type === 'first') || {
      amount: 0,
      method: 'cash',
      received: false,
      date: '',
      type: 'first',
    };
    
    const secondPayment = payments.find(p => p.type === 'second') || {
      amount: 0,
      method: 'pos',
      received: false,
      date: '',
      type: 'second',
    };
    
    console.log("First payment:", firstPayment);
    console.log("Second payment:", secondPayment);
    
    return {
      ...booking,
      payments,
      firstPayment,
      secondPayment,
      finalPrice: booking?.pricing?.agreedPrice || 0,
      paymentStatus: booking?.pricing?.paymentStatus || 'No Payment',
    };
  });
  const handleEditInSanAntonio = () => {
    onClose(); // Close the modal first
    navigate('/san-antonio-tours', { state: { editBookingId: booking.id } });
  };

  const isSanAntonioBooking = booking?.location === 'San Antonio';
  const handleExpensePaymentStatusChange = async (expenseId, newStatus) => {
    console.log("Changing expense:", expenseId, "to", newStatus);
    try {
      
      await updateDoc(doc(db, "expenses", expenseId), { paymentStatus: newStatus });
      console.log("...Firestore update completed successfully!");
  
      setLinkedExpenses((prevExpenses) => {
        return prevExpenses.map((parentExp) => {
          let updatedParent = parentExp; 
      
          if (parentExp.id === expenseId) {
            updatedParent = { ...parentExp, paymentStatus: newStatus };
          }
      
          if (Array.isArray(parentExp.subExpenses) && parentExp.subExpenses.length) {
            const updatedSubExpenses = parentExp.subExpenses.map((sub) => {
              if (sub.id === expenseId) {
                
                return { ...sub, paymentStatus: newStatus };
              }
              return sub;
            });
            
            updatedParent = { ...updatedParent, subExpenses: updatedSubExpenses };
          }
      
          return updatedParent;
        });
      });
      
    } catch (error) {
      console.error("Error updating payment status:", error);
      alert("Failed to update payment status. Please try again.");
    }
  };

  // LinkedOrdersSection Component


  const LinkedOrdersSection = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0); // Use to force re-renders
    
    // Initial data load
    useEffect(() => {
      if (!booking?.id) return;
      
      console.log("Initial orders fetch for booking:", booking.id);
      setIsLoading(true);
      
      // Get a fresh copy of the booking to ensure we have the latest linkedOrders
      const fetchData = async () => {
        try {
          const bookingRef = doc(db, "bookings", booking.id);
          const bookingDoc = await getDoc(bookingRef);
          
          if (!bookingDoc.exists()) {
            console.error("Booking not found");
            setIsLoading(false);
            return;
          }
          
          const bookingData = bookingDoc.data();
          const linkedOrders = bookingData.linkedOrders || [];
          
          console.log("Found linkedOrders:", linkedOrders);
          
          if (linkedOrders.length === 0) {
            console.log("No linked orders found for this booking");
            setOrders([]);
            setIsLoading(false);
            return;
          }
          
          // Fetch full order details for each linked order
          const orderDetails = [];
          
          for (const linkedOrder of linkedOrders) {
            if (!linkedOrder.orderDocId) {
              console.log("Skipping order without orderDocId:", linkedOrder);
              continue;
            }
            
            try {
              const orderDoc = await getDoc(doc(db, "orders", linkedOrder.orderDocId));
              
              if (orderDoc.exists()) {
                orderDetails.push({
                  id: orderDoc.id,
                  ...orderDoc.data()
                });
              } else {
                console.log(`Order ${linkedOrder.orderDocId} not found in database`);
              }
            } catch (err) {
              console.error(`Error fetching order ${linkedOrder.orderDocId}:`, err);
            }
          }
          
          console.log("Successfully fetched order details:", orderDetails);
          setOrders(orderDetails);
        } catch (error) {
          console.error("Error fetching linked orders:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchData();
    }, [booking?.id, forceUpdate]);
    
    // Handle deleting an order
    const handleDeleteOrder = async (order) => {
      if (isUpdating) {
        console.log("Already updating, ignoring request");
        return;
      }
      
      // Get order identifiers
      const orderId = order.id;
      
      if (!orderId) {
        alert("Cannot delete this order: Missing ID");
        return;
      }
      
      // Confirm deletion
      if (!window.confirm(`Are you sure you want to remove this order (${order.orderId || orderId}) from the booking?`)) {
        return;
      }
      
      // Start the update process
      setIsUpdating(true);
      
      try {
        // 1. Get the current booking data
        const bookingRef = doc(db, "bookings", booking.id);
        const bookingDoc = await getDoc(bookingRef);
        
        if (!bookingDoc.exists()) {
          throw new Error("Booking not found");
        }
        
        // 2. Update the linkedOrders array in the booking document
        const bookingData = bookingDoc.data();
        const currentLinkedOrders = bookingData.linkedOrders || [];
        
        console.log("Current linkedOrders:", currentLinkedOrders);
        console.log("Removing order with ID:", orderId);
        
        // Filter out the order to be removed
        const updatedLinkedOrders = currentLinkedOrders.filter(
          linkedOrder => linkedOrder.orderDocId !== orderId
        );
        
        console.log("Updated linkedOrders:", updatedLinkedOrders);
        
        if (currentLinkedOrders.length === updatedLinkedOrders.length) {
          console.warn("No orders were removed - possible ID mismatch");
          
          // Try a more aggressive approach using all possible identifiers
          const aggressivelyFilteredOrders = currentLinkedOrders.filter(linkedOrder => {
            return linkedOrder.orderDocId !== orderId && 
                   linkedOrder.orderId !== order.orderId;
          });
          
          if (aggressivelyFilteredOrders.length < currentLinkedOrders.length) {
            console.log("Aggressive filtering worked, using that instead");
            await updateDoc(bookingRef, {
              linkedOrders: aggressivelyFilteredOrders,
              lastUpdated: serverTimestamp()
            });
          } else {
            console.error("Could not identify the order to remove");
            alert("Could not remove the order - ID mismatch. Please refresh and try again.");
            setIsUpdating(false);
            return;
          }
        } else {
          // Normal case - we successfully filtered out the order
          await updateDoc(bookingRef, {
            linkedOrders: updatedLinkedOrders,
            lastUpdated: serverTimestamp()
          });
        }
        
        // 3. Update the local state to remove the order from the UI immediately
        setOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
        
        // 4. Force a complete refresh of the component
        setTimeout(() => {
          setForceUpdate(prev => prev + 1);
          setIsUpdating(false);
        }, 500);
        
        console.log("Order successfully removed");
      } catch (error) {
        console.error("Error removing order:", error);
        alert(`Error removing order: ${error.message}`);
        setIsUpdating(false);
      }
    };
    
    // Handle order status update
    const handleOrderStatusUpdate = async (order, field, newValue) => {
      if (isUpdating) return;
      setIsUpdating(true);
      
      try {
        // Update the order in the orders collection
        const orderRef = doc(db, "orders", order.id);
        await updateDoc(orderRef, {
          [field]: newValue,
          updatedAt: serverTimestamp()
        });
        
        // Update the booking's linkedOrders array to reflect the change
        const bookingRef = doc(db, "bookings", booking.id);
        const bookingDoc = await getDoc(bookingRef);
        
        if (bookingDoc.exists()) {
          const bookingData = bookingDoc.data();
          const linkedOrders = bookingData.linkedOrders || [];
          
          const updatedLinkedOrders = linkedOrders.map(linkedOrder => {
            if (linkedOrder.orderDocId === order.id) {
              return {
                ...linkedOrder,
                [field]: newValue
              };
            }
            return linkedOrder;
          });
          
          await updateDoc(bookingRef, {
            linkedOrders: updatedLinkedOrders,
            lastUpdated: serverTimestamp()
          });
        }
        
        // Update local state
        setOrders(prevOrders => 
          prevOrders.map(o => 
            o.id === order.id ? { ...o, [field]: newValue } : o
          )
        );
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        alert(`Failed to update ${field}. Please try again.`);
      } finally {
        setIsUpdating(false);
      }
    };
    
    // View order details
    const handleViewOrder = (order) => {
      alert(`Order Details:\n
        Order ID: ${order.orderId || 'N/A'}\n
        Status: ${order.status || 'N/A'}\n
        Total: €${(order.amount_total || order.amount || 0).toFixed(2)}\n
        Items: ${order.items ? order.items.length : 0} items
      `);
    };
    
    // Get status color
    const getStatusColor = (status) => {
      switch (status) {
        case 'paid':
        case 'delivered':
        case 'completed':
          return 'bg-green-100 text-green-800';
        case 'pending':
        case 'preparing':
          return 'bg-yellow-100 text-yellow-800';
        case 'cancelled':
          return 'bg-red-100 text-red-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };
    
    return (
      <div className="p-4 border rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-bold">Linked Orders</h4>
          {isUpdating && <span className="text-sm text-blue-600">Updating...</span>}
        </div>
        
        {isLoading ? (
          <div className="text-center py-4">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No orders linked to this booking</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid/Due</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Delivery</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const totalAmount = order.amount_total || order.amount || 0;
                  const amountPaid = order.payment_details?.amountPaid || 0;
                  const amountDue = Math.max(0, totalAmount - amountPaid);
                  
                  return (
                    <tr key={order.id} id={`order-row-${order.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {order.orderId || 'N/A'}
                      </td>
                      <td className="px-4 py-2">
                        {order.items ? (
                          <ul className="list-disc list-inside">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="text-sm">
                                {item.quantity} x {item.name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "No items information"
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        €{totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-green-600">€{amountPaid.toFixed(2)} paid</div>
                        {amountDue > 0 && (
                          <div className="text-red-600">€{amountDue.toFixed(2)} due</div>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOrderStatusUpdate(
                            order, 
                            'paymentStatus', 
                            order.paymentStatus === 'paid' ? 'unpaid' : 'paid'
                          )}
                          disabled={isUpdating}
                          className={`
                            px-2 py-1 rounded-full text-xs font-medium cursor-pointer
                            ${getStatusColor(order.paymentStatus)}
                            ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          {order.paymentStatus || 'unpaid'}
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOrderStatusUpdate(
                            order, 
                            'deliveryStatus', 
                            order.deliveryStatus === 'delivered' ? 'pending' : 'delivered'
                          )}
                          disabled={isUpdating}
                          className={`
                            px-2 py-1 rounded-full text-xs font-medium cursor-pointer
                            ${getStatusColor(order.deliveryStatus || order.status)}
                            ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          {order.deliveryStatus || order.status || 'pending'}
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap flex space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-900 px-2 py-1 bg-blue-50 rounded"
                          onClick={() => handleViewOrder(order)}
                        >
                          View
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900 px-2 py-1 bg-red-50 rounded"
                          onClick={() => handleDeleteOrder(order)}
                          disabled={isUpdating}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const handlePaymentChange = (paymentIndex, updates) => {
    setEditedBooking((prev) => {
      const updatedPayments = [...(prev.pricing?.payments || [])];
      
      if (!updatedPayments[paymentIndex]) {
        updatedPayments[paymentIndex] = {
          type: paymentIndex === 0 ? 'first' : 'second',
          amount: 0,
          method: paymentIndex === 0 ? 'cash' : 'pos',
          received: false,
          date: '',
          excludeVAT: false,
          percentage: paymentIndex === 0 ? 30 : 0,
          recordedAt: new Date().toISOString()
        };
      }
  
      updatedPayments[paymentIndex] = {
        ...updatedPayments[paymentIndex],
        ...updates
      };
  
      const totalPaid = updatedPayments.reduce((sum, payment) => 
        sum + (payment.received ? (Number(payment.amount) || 0) : 0), 0
      );
  
      let paymentStatus = 'No Payment';
      if (totalPaid > 0) {
        paymentStatus = totalPaid >= prev.pricing?.agreedPrice ? 'Completed' : 'Partial';
      }
  
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          payments: updatedPayments,
          totalPaid,
          paymentStatus
        }
      };
    });
  };
  const ExpensesSection = () => {
    const calculateTotal = () => {
      return linkedExpenses.reduce((sum, expense) => {
        const mainAmount = Number(expense.amount) || 0;
        const subExpensesTotal = expense.subExpenses?.reduce(
          (subSum, subExp) => subSum + (Number(subExp.amount) || 0),
          0
        ) || 0;
        return sum + mainAmount + subExpensesTotal;
      }, 0);
    };

    return (
      <div className="p-4 border rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-bold">Linked Expenses</h4>
          <div className="text-sm text-gray-600">
            Total Expenses: €{calculateTotal().toFixed(2)}
          </div>
        </div>

        {linkedExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {linkedExpenses.map(expense => (
                  <React.Fragment key={expense.id}>
                    {/* Parent Expense */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {format(new Date(expense.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{expense.category}</td>
                      <td className="px-4 py-2">{expense.description}</td>
                      <td className="px-4 py-2 whitespace-nowrap">€{Number(expense.amount).toFixed(2)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          onClick={() =>
                            handleExpensePaymentStatusChange(
                              expense.id,
                              expense.paymentStatus === 'paid' ? 'pending' : 'paid'
                            )
                          }
                          className={`
                            px-2 py-1 rounded-full text-xs font-medium
                            ${
                              expense.paymentStatus === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }
                          `}
                        >
                          {expense.paymentStatus || 'pending'}
                        </button>
                      </td>
                    </tr>

                    {/* Sub-Expenses */}
                    {expense.subExpenses?.map(subExpense => (
                      <tr key={subExpense.id} className="bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap pl-8">
                          {format(new Date(subExpense.date), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">{subExpense.category}</td>
                        <td className="px-4 py-2">{subExpense.description}</td>
                        <td className="px-4 py-2 whitespace-nowrap">€{Number(subExpense.amount).toFixed(2)}</td>
                        <td>
                          <span
                            onClick={() =>
                              handleExpensePaymentStatusChange(
                                subExpense.id,
                                subExpense.paymentStatus === 'paid' ? 'pending' : 'paid'
                              )
                            }
                            className={`
                              cursor-pointer
                              px-2 py-1 rounded-full text-xs font-medium
                              ${
                                subExpense.paymentStatus === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }
                            `}
                          >
                            {subExpense.paymentStatus || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No expenses linked to this booking</p>
        )}
      </div>
    );
  };

    /**
   * 1) Focus the modal when it opens
   */
  useEffect(() => {
  if (modalRef.current) {
        modalRef.current.focus();
      }
  }, []);
  
    /**
     * 2) Real-time listener for expenses
     */
    useEffect(() => {
      if (!booking) return;
      console.log("Raw booking data:", booking);
      // Extract payments array - ONLY THIS LINE CHANGES
      const payments = Array.isArray(booking?.payments) ? booking.payments : 
                       Array.isArray(booking?.pricing?.payments) ? booking.pricing.payments : [];
      // Get first and second payments
      const firstPayment = payments.find((p) => p.type === "first") || {
        amount: 0,
        method: "cash",
        received: false,
        date: "",
        type: "first",
      };
      const secondPayment = payments.find((p) => p.type === "second") || {
        amount: 0,
        method: "pos",
        received: false,
        date: "",
        type: "second",
      };
      // Debug payments
      console.log("First payment:", firstPayment);
      console.log("Second payment:", secondPayment);
      // Set edited booking state
      setEditedBooking({
        ...booking,
        firstPayment,
        secondPayment,
        finalPrice: booking?.pricing?.agreedPrice || 0,
        paymentStatus: booking?.pricing?.paymentStatus || "No Payment",
      });
      // Firestore collection and query setup for expenses
      const expensesRef = collection(db, "expenses");
      const q = query(expensesRef, where("bookingId", "==", booking.id));
      // Real-time listener for expenses
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const allExpenses = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        console.log("Fetched Expenses:", allExpenses);
        // Process and set linked expenses
        const parentExpenses = allExpenses.filter((exp) => !exp.parentId);
        const childExpenses = allExpenses.filter((exp) => exp.parentId);
        const combinedExpenses = parentExpenses.map((parent) => ({
          ...parent,
          subExpenses: childExpenses.filter((child) => child.parentId === parent.id),
        }));
        setLinkedExpenses(combinedExpenses);
      });
      return () => unsubscribe(); // Clean up listener on unmount
    }, [booking]);
    
    
  if (!booking) return null;


  const handleInputChange = (field, value) => {
    setEditedBooking((prev) => {
      if (field === 'firstPayment' || field === 'secondPayment') {
        const updatedPayment = { ...prev[field], ...value };
  
        if (value.received !== undefined) {
          updatedPayment.date = value.received
            ? new Date().toISOString().split('T')[0]
            : '';
        }
  
        const updatedState = {
          ...prev,
          [field]: updatedPayment,
        };
  
        // Update overall payment status
        const firstReceived = updatedState.firstPayment?.received || false;
        const secondReceived = updatedState.secondPayment?.received || false;
  
        updatedState.paymentStatus = firstReceived && secondReceived
          ? 'Completed'
          : firstReceived || secondReceived
          ? 'Partial'
          : 'No Payment';
  
        return updatedState;
      }
  
      // Handle other fields
      return { ...prev, [field]: value };
    });
  };
  
  const handleDeleteBooking = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this booking? This action cannot be undone."
      )
    ) {
      onDelete(booking.id);
    }
  };

  const handleSaveBooking = async () => {
    if (!editedBooking.clientName?.trim()) {
      alert("Client name is required.");
      return;
    }
    if (!editedBooking.bookingDate?.trim()) {
      alert("Booking date is required.");
      return;
    }
  
    const bookingToSave = {
      ...editedBooking,
      clientDetails: {
        ...editedBooking.clientDetails,
        address: editedBooking.clientDetails?.address || ''
      },
      pricing: {
        ...editedBooking.pricing,
        agreedPrice: editedBooking.finalPrice,
        lastUpdated: new Date().toISOString()
      }
    };
    
  
    try {
      await updateDoc(doc(db, "bookings", booking.id), bookingToSave);
      const updatedDoc = await getDoc(doc(db, "bookings", booking.id));
      if (updatedDoc.exists()) {
        setEditedBooking(updatedDoc.data());
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving booking:", error);
      alert("Failed to save booking. Please try again.");
    }
  };
  
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 sm:py-12 bg-black bg-opacity-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-details-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full"
        onClick={handleModalClick}
        ref={modalRef}
      >
        <div className="bg-gray-100 p-4 flex justify-between items-center rounded-t-lg">
          <h3
            id="booking-details-title"
            className="text-xl font-bold text-gray-800"
          >
            Booking Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 focus:outline-none"
            aria-label="Close Modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 16rem)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">Client Information</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Client Name:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientName || ""}
                      onChange={(e) =>
                        handleInputChange("clientName", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientName || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Client Type:
                  </label>
                  <p className="mt-1">{editedBooking.clientType || "N/A"}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Phone:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientPhone || ""}
                      onChange={(e) =>
                        handleInputChange("clientPhone", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientPhone || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Email:
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientEmail || ""}
                      onChange={(e) =>
                        handleInputChange("clientEmail", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientEmail || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Passport:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.clientPassport || ""}
                      onChange={(e) =>
                        handleInputChange("clientPassport", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">
                      {editedBooking.clientPassport || "N/A"}
                    </p>
                  )}
                </div>
                <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Address:
              </label>
              {isEditing ? (
                <textarea
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editedBooking.clientDetails?.address || editedBooking.address || ""}
                  onChange={(e) =>
                    handleInputChange("address", e.target.value)
                  }
                  rows="3"
                  placeholder="Enter client's address"
                />
              ) : (
                <p className="mt-1 whitespace-pre-line">
                  {editedBooking.clientDetails?.address || editedBooking.address || "N/A"}
                </p>
              )}
            </div>
              </div>
            </div>
              
            <div>
              <div className="p-4 border rounded-lg mb-4">
                <h4 className="text-lg font-bold mb-3">Booking Details</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Boat Name:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.boatName || ""}
                      onChange={(e) =>
                        handleInputChange("boatName", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.boatName || "N/A"}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Company:
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={editedBooking.boatCompanyName || ""}
                      onChange={(e) =>
                        handleInputChange("boatCompanyName", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">
                      {editedBooking.boatCompanyName || "N/A"}
                    </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Passengers:
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={
                        isNaN(editedBooking.numberOfPassengers)
                          ? ""
                          : editedBooking.numberOfPassengers
                      }
                      onChange={(e) =>
                        handleInputChange("numberOfPassengers", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">
                      {editedBooking.numberOfPassengers >= 0
                        ? `${editedBooking.numberOfPassengers} passengers`
                        : "N/A"}
                    </p>
                  )}
                </div>
                <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Restaurant Name:
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={editedBooking.restaurantName || ''}
                    onChange={(e) =>
                      handleInputChange("restaurantName", e.target.value)
                    }
                    placeholder="Enter restaurant name"
                  />
                ) : (
                  <p className="mt-1">{editedBooking.restaurantName || 'N/A'}</p>
                )}
              </div>
              </div>

              {editedBooking.privateTransfer && (
                <div className="p-4 border rounded-lg">
                  <h4 className="text-lg font-bold mb-3">Transfer Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium">Pickup</h5>
                      <p>
                        <span className="font-semibold">Location:</span>{" "}
                        {editedBooking.pickupLocation || "N/A"}
                      </p>
                      {editedBooking.pickupAddress && (
                        <p>
                          <span className="font-semibold">Address:</span>{" "}
                          {editedBooking.pickupAddress}
                        </p>
                      )}
                    </div>
                    <div>
                      <h5 className="font-medium">Drop-off</h5>
                      <p>
                        <span className="font-semibold">Location:</span>{" "}
                        {editedBooking.dropoffLocation || "N/A"}
                      </p>
                      {editedBooking.dropoffAddress && (
                        <p>
                          <span className="font-semibold">Address:</span>{" "}
                          {editedBooking.dropoffAddress}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

    <div className="col-span-full">
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">Booking Time</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Date:
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={editedBooking.bookingDate || ""}
                        onChange={(e) =>
                          handleInputChange("bookingDate", e.target.value)
                        }
                      />
                    ) : (
                      <p className="mt-1">
                        {editedBooking.bookingDate
                          ? formatDateDDMMYYYY(editedBooking.bookingDate)
                          : "N/A"}
                      </p>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Time:
                    </label>
                    {isEditing ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={editedBooking.startTime || ""}
                          onChange={(e) =>
                            handleInputChange("startTime", e.target.value)
                          }
                        />
                        <span>-</span>
                        <input
                          type="time"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={editedBooking.endTime || ""}
                          onChange={(e) =>
                            handleInputChange("endTime", e.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <p className="mt-1">
                        {editedBooking.startTime && editedBooking.endTime
                          ? `${editedBooking.startTime} - ${editedBooking.endTime}`
                          : "N/A"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
    </div>

    <div className="col-span-full">
      <PaymentDetails 
        payments={editedBooking?.pricing?.payments || []}
        pricingType={editedBooking?.pricing?.pricingType}
        agreedPrice={editedBooking?.pricing?.agreedPrice}
        totalPaid={editedBooking?.pricing?.totalPaid}
        paymentStatus={editedBooking?.pricing?.paymentStatus}
        isEditing={isEditing}
        onPaymentChange={handlePaymentChange}
      />
    </div>
    
    {/* Linked Orders Section */}
    <div className="col-span-full mt-6">
      <LinkedOrdersSection />
    </div>
   
    {/* Expenses Link */}
    <div className="col-span-full mt-6">
      <ExpensesSection />
    </div>
    
    {/*Additional Information*/}    
    <div className="col-span-full">
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">
                  Additional Information
                </h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Notes:
                  </label>
                  {isEditing ? (
                    <textarea
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24"
                      value={editedBooking.clientNotes || ""}
                      onChange={(e) =>
                        handleInputChange("clientNotes", e.target.value)
                      }
                    />
                  ) : (
                    <p className="mt-1">{editedBooking.clientNotes || "N/A"}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Created:
                    </label>
                    <p className="mt-1">
                      {editedBooking.createdAt
                        ? formatDateTime(editedBooking.createdAt)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Last Updated:
                    </label>
                    <p className="mt-1">
                      {editedBooking.lastUpdated
                        ? formatDateTime(editedBooking.lastUpdated)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Added by:
                    </label>
                    <p className="mt-1">
                      {editedBooking.createdBy &&
                      editedBooking.createdBy.displayName
                        ? editedBooking.createdBy.displayName
                        : editedBooking.createdBy && editedBooking.createdBy.email
                        ? editedBooking.createdBy.email
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
    </div>
    </div>
    </div>

    <div className="bg-gray-100 p-4 flex justify-end space-x-2 rounded-b-lg">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveBooking}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                aria-label="Save Changes"
              >
                Save
              </button>
              
    
    
    {isSanAntonioBooking && (
      <button
        onClick={handleEditInSanAntonio}
        className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 mr-auto"
        aria-label="Edit in San Antonio Tours"
      >
        Edit in San Antonio Tours
      </button>
    )}
  
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                aria-label="Cancel Editing"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Edit Booking"
            >
              Edit
            </button>
          )}
          {!booking.isCancelled && (
            <button
              type="button"
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
              onClick={handleDeleteBooking}
              aria-label="Delete Booking"
            >
              Delete
            </button>
          )}
    </div>
    </div>
    </div>
  );
};

BookingDetails.propTypes = {
  booking: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default BookingDetails;



