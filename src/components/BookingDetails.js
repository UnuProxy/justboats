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
  getDocs,
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
    
    useEffect(() => {
      if (!booking?.id) return;
      
      fetchOrders();
    }, [booking?.id]);
    
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        // Track if we need to update the booking's linkedOrders array
        let needsBookingUpdate = false;
        let updatedLinkedOrders = [];
        
        // First, check if there are linked orders in the booking document
        if (booking.linkedOrders && booking.linkedOrders.length > 0) {
          // For each linked order, get the full order details from Firestore
          const orderPromises = booking.linkedOrders.map(async (linkedOrder) => {
            if (linkedOrder.orderDocId) {
              try {
                const orderDoc = await getDoc(doc(db, "orders", linkedOrder.orderDocId));
                if (orderDoc.exists()) {
                  // Order exists, add to updated list
                  updatedLinkedOrders.push(linkedOrder);
                  return {
                    id: orderDoc.id,
                    ...orderDoc.data(),
                  };
                } else {
                  // Order doesn't exist anymore, mark for removal
                  console.log(`Order ${linkedOrder.orderDocId} no longer exists`);
                  needsBookingUpdate = true;
                  return null;
                }
              } catch (err) {
                console.error("Error fetching linked order:", err);
                return null;
              }
            }
            // Keep orders without orderDocId for backward compatibility
            updatedLinkedOrders.push(linkedOrder);
            return linkedOrder;
          });
          
          const resolvedOrders = await Promise.all(orderPromises);
          
          // Update the booking document if we found deleted orders
          if (needsBookingUpdate && booking.id) {
            try {
              console.log("Updating booking to remove deleted orders");
              const bookingRef = doc(db, "bookings", booking.id);
              await updateDoc(bookingRef, {
                linkedOrders: updatedLinkedOrders,
                lastUpdated: serverTimestamp()
              });
              console.log("Booking updated successfully");
            } catch (updateErr) {
              console.error("Error updating booking's linkedOrders:", updateErr);
            }
          }
          
          setOrders(resolvedOrders.filter(o => o)); // Remove any null results
        } else {
          // If no linked orders in the booking document, query the orders collection
          const ordersRef = collection(db, "orders");
          const q = query(
            ordersRef,
            where("booking_info.bookingId", "==", booking.id)
          );
          
          const querySnapshot = await getDocs(q);
          const orderData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setOrders(orderData);
          
          // If we found orders but the booking doesn't have linkedOrders,
          // update the booking with these orders
          if (orderData.length > 0 && booking.id) {
            try {
              const linkedOrdersToAdd = orderData.map(order => ({
                orderDocId: order.id,
                orderId: order.orderId,
                status: order.status,
                paymentStatus: order.paymentStatus,
                deliveryStatus: order.deliveryStatus || order.status,
                amount: order.amount_total || order.amount || 0
              }));
              
              const bookingRef = doc(db, "bookings", booking.id);
              await updateDoc(bookingRef, {
                linkedOrders: linkedOrdersToAdd,
                lastUpdated: serverTimestamp()
              });
              console.log("Added linkedOrders to booking");
            } catch (updateErr) {
              console.error("Error adding linkedOrders to booking:", updateErr);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const handleOrderStatusUpdate = async (order, field, newValue) => {
      if (isUpdating) return; // Prevent multiple simultaneous updates
      
      const orderId = order.id || order.orderDocId;
      if (!orderId) {
        console.error("Cannot update order: missing ID");
        return;
      }
      
      setIsUpdating(true);
      
      try {
        // First check if the order still exists
        const orderRef = doc(db, "orders", orderId);
        const orderDoc = await getDoc(orderRef);
        
        if (!orderDoc.exists()) {
          console.log(`Order ${orderId} no longer exists, refreshing view`);
          // If order doesn't exist, refresh the orders list to clean up
          fetchOrders();
          setIsUpdating(false);
          return;
        }
        
        // Calculate updated payment details when changing payment status
        let orderUpdate = {
          [field]: newValue,
          updatedAt: serverTimestamp()
        };
        
        if (field === 'paymentStatus') {
          // If updating payment status to paid, update payment_details
          const totalAmount = order.amount_total || order.amount || 0;
          
          if (newValue === 'paid') {
            orderUpdate.payment_details = {
              ...(order.payment_details || {}),
              amountPaid: totalAmount,
              amountDue: 0
            };
          } else if (newValue === 'partially_paid') {
            // Handle partial payment - you might want to prompt for amount
            const amountPaid = order.payment_details?.amountPaid || 0;
            orderUpdate.payment_details = {
              ...(order.payment_details || {}),
              amountDue: totalAmount - amountPaid
            };
          } else {
            // If unpaid, reset payment details
            orderUpdate.payment_details = {
              ...(order.payment_details || {}),
              amountPaid: 0,
              amountDue: totalAmount
            };
          }
        }
        
        // If setting payment to paid and delivery to delivered, update overall status too
        if (field === 'paymentStatus' && newValue === 'paid' && 
            (order.deliveryStatus === 'delivered' || order.status === 'dispatched')) {
          orderUpdate.status = 'completed';
        } else if (field === 'deliveryStatus' && newValue === 'delivered' && 
                  order.paymentStatus === 'paid') {
          orderUpdate.status = 'completed';
        }
        
        // Update the order document in Firestore
        await updateDoc(orderRef, orderUpdate);
        
        console.log(`Updated order ${orderId} ${field} to ${newValue}`, orderUpdate);
        
        // Now update the booking document to reflect these changes
        if (booking?.id) {
          const bookingRef = doc(db, "bookings", booking.id);
          const bookingDoc = await getDoc(bookingRef);
          
          if (bookingDoc.exists()) {
            const bookingData = bookingDoc.data();
            let linkedOrders = bookingData.linkedOrders || [];
            
            // Find and update the specific order in the linkedOrders array
            const updatedLinkedOrders = linkedOrders.map(linkOrder => {
              if (linkOrder.orderDocId === orderId || linkOrder.orderId === order.orderId) {
                // Update the order info in the linkedOrders array
                const updatedLinkOrder = { ...linkOrder, [field]: newValue };
                
                // Also update payment details if needed
                if (field === 'paymentStatus') {
                  const totalAmount = linkOrder.amount || order.amount_total || 0;
                  
                  if (newValue === 'paid') {
                    updatedLinkOrder.amountPaid = totalAmount;
                    updatedLinkOrder.amountDue = 0;
                  } else if (newValue === 'unpaid') {
                    updatedLinkOrder.amountPaid = 0;
                    updatedLinkOrder.amountDue = totalAmount;
                  }
                }
                
                return updatedLinkOrder;
              }
              return linkOrder;
            });
            
            // Determine overall order status for the booking
            const allOrdersPaid = updatedLinkedOrders.every(o => o.paymentStatus === 'paid');
            const allOrdersDelivered = updatedLinkedOrders.every(
              o => o.deliveryStatus === 'delivered' || o.status === 'dispatched'
            );
            
            let bookingOrderStatus = bookingData.orderStatus || 'pending';
            if (allOrdersPaid && allOrdersDelivered) {
              bookingOrderStatus = 'fulfilled';
            } else if (allOrdersPaid) {
              bookingOrderStatus = 'paid';
            } else if (allOrdersDelivered) {
              bookingOrderStatus = 'delivered';
            }
            
            // Update the booking
            await updateDoc(bookingRef, {
              linkedOrders: updatedLinkedOrders,
              orderStatus: bookingOrderStatus,
              lastUpdated: serverTimestamp()
            });
            
            console.log(`Updated booking ${booking.id} to reflect order changes`);
          }
        }
        
        // Refresh the order list after updating
        fetchOrders();
      } catch (error) {
        console.error("Error updating order status:", error);
        alert(`Failed to update order ${field}. Please try again.`);
      } finally {
        setIsUpdating(false);
      }
    };
    
    // Function to handle order deletion
    const handleDeleteOrder = async (order) => {
      if (isUpdating) return;
      
      const orderId = order.id || order.orderDocId;
      if (!orderId) {
        console.error("Cannot delete order: missing ID");
        return;
      }
      
      if (!window.confirm(`Are you sure you want to remove this order (${order.orderId || orderId}) from the booking?`)) {
        return;
      }
      
      setIsUpdating(true);
      
      try {
        // Update the booking to remove the order from linkedOrders
        if (booking?.id) {
          const bookingRef = doc(db, "bookings", booking.id);
          const bookingDoc = await getDoc(bookingRef);
          
          if (bookingDoc.exists()) {
            const bookingData = bookingDoc.data();
            let linkedOrders = bookingData.linkedOrders || [];
            
            // Filter out the order to be deleted
            const updatedLinkedOrders = linkedOrders.filter(
              linkOrder => linkOrder.orderDocId !== orderId && linkOrder.orderId !== order.orderId
            );
            
            // Update the booking
            await updateDoc(bookingRef, {
              linkedOrders: updatedLinkedOrders,
              lastUpdated: serverTimestamp()
            });
            
            console.log(`Removed order ${orderId} from booking ${booking.id}`);
            
            // Refresh the orders list
            fetchOrders();
          }
        }
      } catch (error) {
        console.error("Error removing order from booking:", error);
        alert("Failed to remove order from booking. Please try again.");
      } finally {
        setIsUpdating(false);
      }
    };
    
    // Function to determine remaining amount
    const getRemainingAmount = (order) => {
      const totalAmount = order.amount_total || order.amount || 0;
      const amountPaid = order.payment_details?.amountPaid || 0;
      return Math.max(0, totalAmount - amountPaid).toFixed(2);
    };
    
    // Function to open order details 
    const handleViewOrder = (order) => {
      if (!order || !order.id) {
        alert("Cannot view order: missing ID");
        return;
      }
      
      // You might implement different navigation depending on your app
      // For now, we'll just alert with the order details
      const details = `
        Order ID: ${order.orderId}
        Status: ${order.status || 'N/A'}
        Payment Status: ${order.paymentStatus || 'N/A'}
        Total Amount: €${(order.amount_total || order.amount || 0).toFixed(2)}
        Amount Paid: €${(order.payment_details?.amountPaid || 0).toFixed(2)}
        Amount Due: €${getRemainingAmount(order)}
      `;
      
      alert(`Order Details:\n${details}`);
      
      // Depending on your app navigation, you could navigate to the order instead:
      // navigate(`/orders/${order.id}`);
    };
    
    // Status badge color mapping
    const getStatusColor = (status) => {
      switch (status) {
        case 'paid':
        case 'delivered':
        case 'dispatched':
        case 'ready_for_pickup':
        case 'completed':
          return 'bg-green-100 text-green-800';
        case 'partially_paid':
        case 'preparing':
        case 'pending':
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
          {isUpdating && (
            <span className="text-sm text-blue-600">Updating...</span>
          )}
        </div>
        
        {isLoading ? (
          <div className="text-center py-4">
            <p>Loading orders...</p>
          </div>
        ) : orders?.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No orders linked to this booking</p>
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
                {orders.map((order, index) => {
                  const totalAmount = order.amount_total || order.amount || 0;
                  const amountPaid = order.payment_details?.amountPaid || 0;
                  const amountDue = Math.max(0, totalAmount - amountPaid);
                  
                  return (
                    <tr key={order.id || order.orderDocId || index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {order.orderId}
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
                          {order.paymentStatus || 'pending'}
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



