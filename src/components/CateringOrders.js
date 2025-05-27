import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/firebaseConfig';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
 
  doc,
  limit,
  startAfter,
  getDocs,
  where,
  documentId,
} from 'firebase/firestore';
import { CheckCircle, XCircle, Search, X, Printer, Plus } from 'lucide-react';
import ManualOrderEntry from './ManualEntryOrder';

const ORDERS_PER_PAGE = 10;

const CateringOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('today-tomorrow');
  const [showManualOrderForm, setShowManualOrderForm] = useState(false);

  // Enhanced data fetching functions
  const fetchRelatedData = async (orders) => {
    if (!orders || orders.length === 0) return orders;

    try {
      // Extract all unique IDs for batch fetching
      const productIds = new Set();
      const userIds = new Set();
      const sessionIds = [];
      
      orders.forEach(order => {
        // Extract product IDs from items
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.id) productIds.add(item.id);
          });
        }
        
        // Extract session IDs for payment data
        if (order.sessionId) {
          sessionIds.push(order.sessionId);
        }
        
        // Extract user-related IDs if available
        if (order.userId) {
          userIds.add(order.userId);
        }
      });

      // Fetch products data
      const productsData = await fetchProductsData([...productIds]);
      
      // Fetch payments data
      const paymentsData = await fetchPaymentsData(sessionIds);
      
      // Fetch users data
      const usersData = await fetchUsersData([...userIds]);
      
      // Fetch places data (if there are location references)
      const placesData = await fetchPlacesData(orders);
      
      // Fetch pricing items
      const pricingItemsData = await fetchPricingItemsData([...productIds]);

      // Combine all data with orders
      const enrichedOrders = orders.map(order => ({
        ...order,
        enrichedItems: order.items ? order.items.map(item => ({
          ...item,
          productDetails: productsData[item.id] || null,
          pricingDetails: pricingItemsData[item.id] || null,
        })) : [],
        paymentDetails: paymentsData[order.sessionId] || null,
        userDetails: usersData[order.userId] || null,
        locationDetails: placesData[order.boatLocation] || null,
      }));

      return enrichedOrders;
    } catch (error) {
      console.error('Error fetching related data:', error);
      return orders; // Return original orders if enrichment fails
    }
  };

  const fetchProductsData = async (productIds) => {
    if (productIds.length === 0) return {};
    
    try {
      // Firestore 'in' queries are limited to 10 items, so we need to batch
      const batches = [];
      for (let i = 0; i < productIds.length; i += 10) {
        const batch = productIds.slice(i, i + 10);
        batches.push(batch);
      }
      
      const allProducts = {};
      
      for (const batch of batches) {
        const productsQuery = query(
          collection(db, 'products'),
          where(documentId(), 'in', batch)
        );
        
        const snapshot = await getDocs(productsQuery);
        snapshot.docs.forEach(doc => {
          allProducts[doc.id] = { id: doc.id, ...doc.data() };
        });
      }
      
      return allProducts;
    } catch (error) {
      console.error('Error fetching products:', error);
      return {};
    }
  };

  const fetchPaymentsData = async (sessionIds) => {
    if (sessionIds.length === 0) return {};
    
    try {
      const paymentsData = {};
      
      // Batch fetch payments by session ID
      const batches = [];
      for (let i = 0; i < sessionIds.length; i += 10) {
        const batch = sessionIds.slice(i, i + 10);
        batches.push(batch);
      }
      
      for (const batch of batches) {
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('sessionId', 'in', batch)
        );
        
        const snapshot = await getDocs(paymentsQuery);
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          paymentsData[data.sessionId] = { id: doc.id, ...data };
        });
      }
      
      return paymentsData;
    } catch (error) {
      console.error('Error fetching payments:', error);
      return {};
    }
  };

  const fetchUsersData = async (userIds) => {
    if (userIds.length === 0) return {};
    
    try {
      const usersData = {};
      
      const batches = [];
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        batches.push(batch);
      }
      
      for (const batch of batches) {
        const usersQuery = query(
          collection(db, 'users'),
          where(documentId(), 'in', batch)
        );
        
        const snapshot = await getDocs(usersQuery);
        snapshot.docs.forEach(doc => {
          usersData[doc.id] = { id: doc.id, ...doc.data() };
        });
      }
      
      return usersData;
    } catch (error) {
      console.error('Error fetching users:', error);
      return {};
    }
  };

  const fetchPlacesData = async (orders) => {
    try {
      const locationNames = new Set();
      orders.forEach(order => {
        if (order.boatLocation && order.boatLocation !== 'Not specified') {
          locationNames.add(order.boatLocation);
        }
      });
      
      if (locationNames.size === 0) return {};
      
      const placesData = {};
      
      // Fetch places by name or other identifier
      const placesQuery = query(collection(db, 'places'));
      const snapshot = await getDocs(placesQuery);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (locationNames.has(data.name) || locationNames.has(doc.id)) {
          placesData[data.name || doc.id] = { id: doc.id, ...data };
        }
      });
      
      return placesData;
    } catch (error) {
      console.error('Error fetching places:', error);
      return {};
    }
  };

  const fetchPricingItemsData = async (productIds) => {
    if (productIds.length === 0) return {};
    
    try {
      const pricingData = {};
      
      const batches = [];
      for (let i = 0; i < productIds.length; i += 10) {
        const batch = productIds.slice(i, i + 10);
        batches.push(batch);
      }
      
      for (const batch of batches) {
        const pricingQuery = query(
          collection(db, 'pricingItems'),
          where('productId', 'in', batch)
        );
        
        const snapshot = await getDocs(pricingQuery);
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          pricingData[data.productId] = { id: doc.id, ...data };
        });
      }
      
      return pricingData;
    } catch (error) {
      console.error('Error fetching pricing items:', error);
      return {};
    }
  };

  // Fetch reminders for orders
  const fetchReminders = async (orderIds) => {
    if (orderIds.length === 0) return {};
    
    try {
      const remindersData = {};
      
      const remindersQuery = query(
        collection(db, 'reminders'),
        where('orderId', 'in', orderIds)
      );
      
      const snapshot = await getDocs(remindersQuery);
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!remindersData[data.orderId]) {
          remindersData[data.orderId] = [];
        }
        remindersData[data.orderId].push({ id: doc.id, ...data });
      });
      
      return remindersData;
    } catch (error) {
      console.error('Error fetching reminders:', error);
      return {};
    }
  };

  useEffect(() => {
    loadInitialOrders();
  }, [selectedStatus]);

  const loadInitialOrders = async () => {
    setLoading(true);
    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(ORDERS_PER_PAGE)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      async (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Debug: Log all available fields in orders
        if (ordersData.length > 0) {
          console.log('Available order fields:', Object.keys(ordersData[0]));
          console.log('Sample order data:', ordersData[0]);
        }
        
        // Fetch all related data
        const enrichedOrders = await fetchRelatedData(ordersData);
        
        // Fetch reminders
        const orderIds = ordersData.map(order => order.id);
        const reminders = await fetchReminders(orderIds);
        
        // Add reminders to orders
        const ordersWithReminders = enrichedOrders.map(order => ({
          ...order,
          reminders: reminders[order.id] || []
        }));
        
        setOrders(ordersWithReminders);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === ORDERS_PER_PAGE);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  };

  const loadMoreOrders = async () => {
    if (!lastVisible) return;

    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      startAfter(lastVisible),
      limit(ORDERS_PER_PAGE)
    );

    const snapshot = await getDocs(ordersQuery);
    const newOrdersData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enrich new orders with related data
    const enrichedNewOrders = await fetchRelatedData(newOrdersData);
    
    // Fetch reminders for new orders
    const orderIds = newOrdersData.map(order => order.id);
    const reminders = await fetchReminders(orderIds);
    
    const newOrdersWithReminders = enrichedNewOrders.map(order => ({
      ...order,
      reminders: reminders[order.id] || []
    }));

    setOrders([...orders, ...newOrdersWithReminders]);
    setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    setHasMore(snapshot.docs.length === ORDERS_PER_PAGE);
  };

  const handleManualOrderAdded = async (newOrder) => {
    // Enrich the new order with related data
    const enrichedOrder = await fetchRelatedData([newOrder]);
    setOrders([enrichedOrder[0], ...orders]);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };
  
  

  const getOrderStatus = (order) => order.status || order.paymentStatus || 'unknown';

  const filterOrders = () => {
    let filtered = orders;

    if (searchQuery.trim()) {
      filtered = filtered.filter(order => 
        (order.orderId && order.orderId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.id && order.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.boatName && order.boatName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.fullName && order.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(
        order => getOrderStatus(order).toLowerCase() === selectedStatus.toLowerCase()
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (activeTab) {
      case 'today-tomorrow':
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.orderDate || order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return (
            orderDate.getTime() === today.getTime() ||
            orderDate.getTime() === tomorrow.getTime()
          );
        });
        break;
      case 'future':
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.orderDate || order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate > tomorrow;
        });
        break;
      case 'past':
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.orderDate || order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate < today;
        });
        break;
      default:
        break;
    }

    return filtered;
  };

  // Enhanced Print Order Component with full details
  const PrintOrder = ({ order }) => {
    return (
      <div className="p-8 print-only">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Order Receipt</h1>
          <p className="text-gray-600">Order #{order.orderId || order.id.slice(-6)}</p>
          {order.isManualOrder && (
            <div className="mt-1 text-sm font-medium px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full inline-block">
              Manual Order via {order.orderSource}
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Customer Details</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><strong>Name:</strong> {order.fullName}</div>
            <div><strong>Boat:</strong> {order.boatName}</div>
            <div><strong>Company:</strong> {order.rentalCompany}</div>
            <div><strong>Phone:</strong> {order.phoneNumber}</div>
            <div className="col-span-2"><strong>Email:</strong> {order.customerEmail}</div>
            <div><strong>Order Date:</strong> {order.orderDate}</div>
            <div><strong>Payment:</strong> {order.paymentMethod}</div>
          </div>
        </div>

        {/* Delivery Information */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Delivery Information</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><strong>Marina:</strong> {order.marina || order.boatLocation || 'Not specified'}</div>
            {order.berthNumber && (
              <div><strong>Berth:</strong> {order.berthNumber}{order.berthName ? ` (${order.berthName})` : ''}</div>
            )}
            {order.deliveryTime && (
              <div><strong>Delivery Time:</strong> {order.deliveryTime}</div>
            )}
            {order.deliveryDate && (
              <div><strong>Delivery Date:</strong> {order.deliveryDate}</div>
            )}
            {order.requestedDeliveryTime && order.requestedDeliveryTime !== order.deliveryTime && (
              <div><strong>Requested Time:</strong> {order.requestedDeliveryTime}</div>
            )}
            {order.contactPerson && order.contactPerson !== order.fullName && (
              <div><strong>Contact Person:</strong> {order.contactPerson}</div>
            )}
            {order.emergencyContact && (
              <div><strong>Emergency Contact:</strong> {order.emergencyContact}</div>
            )}
          </div>
        </div>

        {/* Instructions & Notes */}
        {(order.specialNotes || order.deliveryInstructions || order.notes || order.allergyInfo || order.dietaryRequirements) && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Instructions & Notes</h2>
            <div className="bg-yellow-50 p-3 rounded">
              {order.allergyInfo && (
                <div className="mb-2 p-2 bg-red-100 rounded">
                  <strong className="text-red-800">⚠️ ALLERGY ALERT:</strong>
                  <span className="ml-2 text-red-700 font-medium">{order.allergyInfo}</span>
                </div>
              )}
              {order.specialNotes && (
                <div className="mb-2">
                  <strong>Notes:</strong> {order.specialNotes}
                </div>
              )}
              {order.deliveryInstructions && (
                <div className="mb-2">
                  <strong>Delivery Instructions:</strong> {order.deliveryInstructions}
                </div>
              )}
              {order.notes && order.notes !== order.specialNotes && (
                <div className="mb-2">
                  <strong>Additional Notes:</strong> {order.notes}
                </div>
              )}
              {order.dietaryRequirements && (
                <div>
                  <strong>Dietary Requirements:</strong> {order.dietaryRequirements}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Details */}
        {order.paymentDetails && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Payment Details</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><strong>Method:</strong> {order.paymentMethod}</div>
              <div><strong>Status:</strong> {order.paymentStatus}</div>
              <div><strong>Currency:</strong> {order.currency?.toUpperCase()}</div>
              {order.paymentDetails.transactionId && (
                <div><strong>Transaction:</strong> {order.paymentDetails.transactionId}</div>
              )}
            </div>
          </div>
        )}

        {order.enrichedItems && order.enrichedItems.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Order Items</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Item</th>
                  <th className="text-center py-2">Quantity</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.enrichedItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.productDetails && (
                          <div className="text-sm text-gray-600">
                            {item.productDetails.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="text-right py-2">€{item.price.toFixed(2)}</td>
                    <td className="text-right py-2">€{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan="3" className="text-right py-2">Total:</td>
                  <td className="text-right py-2">€{order.amount_total?.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Reminders */}
        {order.reminders && order.reminders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Reminders</h2>
            <div className="space-y-2">
              {order.reminders.map((reminder, index) => (
                <div key={index} className="bg-yellow-50 p-2 rounded">
                  <div className="font-medium">{reminder.title}</div>
                  <div className="text-sm text-gray-600">{reminder.message}</div>
                  {reminder.scheduledFor && (
                    <div className="text-xs text-gray-500">
                      Scheduled: {new Date(reminder.scheduledFor).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Thank you for your order!</p>
        </div>
      </div>
    );
  };

  const OrderCard = ({ order }) => {
    const printRef = useRef();

    const handlePrint = (order) => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Order #${order.orderId || order.id.slice(-6)}</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <style>
              @media print {
                body { padding: 20px; }
                .print-only { display: block; }
              }
            </style>
          </head>
          <body>
      `);
      
      const printContent = printRef.current.cloneNode(true);
      printWindow.document.body.appendChild(printContent);
      
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };

    return (
      <>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
            <div className="w-full sm:w-auto mb-2 sm:mb-0">
              <div className="flex items-center">
                <h3 className="text-lg font-semibold">
                  Order #{order.orderId || order.id.slice(-6)}
                </h3>
                {order.isManualOrder && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    {order.orderSource}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><strong>Boat:</strong> {order.boatName}</div>
                  <div><strong>Company:</strong> {order.rentalCompany}</div>
                  <div><strong>Client:</strong> {order.fullName}</div>
                  <div><strong>Phone:</strong> {order.phoneNumber}</div>
                  <div className="sm:col-span-2"><strong>Email:</strong> {order.customerEmail}</div>
                  <div><strong>Order Date:</strong> {order.orderDate}</div>
                  <div><strong>Payment:</strong> {order.paymentMethod}</div>
                </div>
              </div>
            </div>
            <span
              className={'px-3 py-1 rounded-full text-sm whitespace-nowrap mt-2 sm:mt-0 sm:ml-4 ' + (
                getOrderStatus(order).toLowerCase() === 'preparing'
                  ? 'bg-yellow-100 text-yellow-800'
                  : getOrderStatus(order).toLowerCase() === 'ready_for_pickup'
                  ? 'bg-purple-100 text-purple-800'
                  : getOrderStatus(order).toLowerCase() === 'dispatched'
                  ? 'bg-blue-100 text-blue-800'
                  : getOrderStatus(order).toLowerCase() === 'delivered'
                  ? 'bg-green-100 text-green-800'
                  : getOrderStatus(order).toLowerCase() === 'pending'
                  ? 'bg-gray-100 text-gray-800'
                  : getOrderStatus(order).toLowerCase() === 'paid'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              {getOrderStatus(order).charAt(0).toUpperCase() + getOrderStatus(order).slice(1).replace('_', ' ')}
            </span>
          </div>

          {/* Delivery Summary - Only show if there are meaningful delivery details */}
          {(order.berthNumber || order.deliveryTime || order.requestedDeliveryTime || order.contactPerson || order.allergyInfo) && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">📍 Delivery Details</h4>
              <div className="text-sm text-blue-700 space-y-1">
                {(order.boatLocation || order.marina) && (
                  <div>🏊 <strong>Marina:</strong> {order.marina || order.boatLocation}</div>
                )}
                {order.berthNumber && (
                  <div>📍 <strong>Berth:</strong> {order.berthNumber}{order.berthName ? ` (${order.berthName})` : ''}</div>
                )}
                {order.deliveryTime && (
                  <div>🕐 <strong>Delivery Time:</strong> {order.deliveryTime}</div>
                )}
                {order.requestedDeliveryTime && order.requestedDeliveryTime !== order.deliveryTime && (
                  <div>⏰ <strong>Requested Time:</strong> {order.requestedDeliveryTime}</div>
                )}
                {order.contactPerson && order.contactPerson !== order.fullName && (
                  <div>👤 <strong>Contact Person:</strong> {order.contactPerson}</div>
                )}
                {order.allergyInfo && (
                  <div>⚠️ <strong className="text-red-700">Allergies:</strong> <span className="text-red-700 font-medium">{order.allergyInfo}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Products Section with enriched data */}
          {order.enrichedItems && order.enrichedItems.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <h4 className="font-medium mb-2">Products Ordered:</h4>
              <div className="space-y-2">
                {order.enrichedItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-start bg-gray-50 p-3 rounded">
                    <div className="flex-1 min-w-0 mr-2">
                      <span className="font-medium block">{item.name}</span>
                      {item.productDetails && (
                        <span className="text-gray-500 text-sm block mt-1">
                          {item.productDetails.description}
                        </span>
                      )}
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-gray-500 text-sm">x{item.quantity}</span>
                        {item.productDetails && item.productDetails.category && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {item.productDetails.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-700 whitespace-nowrap font-medium">
                      €{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t mt-2 pt-2">
                  <span>Total</span>
                  <span>€{order.amount_total?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Special Notes & Instructions - Only show unique information */}
          {(order.specialNotes || order.deliveryInstructions || order.notes || order.dietaryRequirements) && (
            <div className="mt-3 border-t pt-3">
              <h4 className="font-medium mb-2">📝 Special Instructions:</h4>
              <div className="bg-yellow-50 p-3 rounded">
                {order.specialNotes && (
                  <div className="mb-2">
                    <span className="font-medium text-yellow-800">Notes:</span>
                    <span className="ml-2 text-yellow-700">{order.specialNotes}</span>
                  </div>
                )}
                {order.deliveryInstructions && (
                  <div className="mb-2">
                    <span className="font-medium text-yellow-800">Delivery Instructions:</span>
                    <span className="ml-2 text-yellow-700">{order.deliveryInstructions}</span>
                  </div>
                )}
                {order.notes && order.notes !== order.specialNotes && (
                  <div className="mb-2">
                    <span className="font-medium text-yellow-800">Additional Notes:</span>
                    <span className="ml-2 text-yellow-700">{order.notes}</span>
                  </div>
                )}
                {order.dietaryRequirements && (
                  <div>
                    <span className="font-medium text-green-800">🥗 Dietary Requirements:</span>
                    <span className="ml-2 text-green-700">{order.dietaryRequirements}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reminders Section */}
          {order.reminders && order.reminders.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <h4 className="font-medium mb-2">Reminders:</h4>
              <div className="space-y-1">
                {order.reminders.map((reminder, index) => (
                  <div key={index} className="bg-yellow-50 p-2 rounded text-sm">
                    <div className="font-medium text-yellow-800">{reminder.title}</div>
                    {reminder.message && (
                      <div className="text-yellow-700">{reminder.message}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-end gap-2 mt-4">
          
            
            <button
              onClick={() => handlePrint(order)}
              className="flex items-center px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
            >
              <Printer className="w-4 h-4 mr-1" />
              Print
            </button>

            {getOrderStatus(order).toLowerCase() !== 'preparing' &&
             getOrderStatus(order).toLowerCase() !== 'delivered' &&
             getOrderStatus(order).toLowerCase() !== 'cancelled' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'preparing')}
                className="flex items-center px-3 py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Mark as </span>Preparing
              </button>
            )}

            {getOrderStatus(order).toLowerCase() === 'preparing' && (
              <>
                <button
                  onClick={() => updateOrderStatus(order.id, 'ready_for_pickup')}
                  className="flex items-center px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Ready for Pickup
                </button>
                <button
                  onClick={() => updateOrderStatus(order.id, 'dispatched')}
                  className="flex items-center px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Dispatch
                </button>
              </>
            )}

            {getOrderStatus(order).toLowerCase() === 'ready_for_pickup' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'delivered')}
                className="flex items-center px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark as Picked Up
              </button>
            )}

            {getOrderStatus(order).toLowerCase() === 'dispatched' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'delivered')}
                className="flex items-center px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Deliver
              </button>
            )}

            {getOrderStatus(order).toLowerCase() !== 'cancelled' &&
             getOrderStatus(order).toLowerCase() !== 'delivered' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'cancelled')}
                className="flex items-center px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Cancel
              </button>
            )}
          </div>
        </div>
        
        <div className="hidden">
          <div ref={printRef}>
            <PrintOrder order={order} />
          </div>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const filteredOrders = filterOrders();

  return (
    <div className="container mx-auto px-4 py-6">
      {showManualOrderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto">
            <ManualOrderEntry 
              onClose={() => setShowManualOrderForm(false)} 
              onOrderAdded={handleManualOrderAdded}
            />
          </div>
        </div>
      )}
      
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Orders Dashboard</h1>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowManualOrderForm(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5 mr-1" />
              Add Manual Order
            </button>
            
            <div className="w-full sm:w-auto relative">
              <input
                type="text"
                placeholder="Search order #, boat, client, berth, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 border rounded-lg px-4 py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready_for_pickup">Ready for Pickup</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="flex border rounded-lg overflow-hidden">
            {['today-tomorrow', 'future', 'past'].map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === tab
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'today-tomorrow'
                  ? "Today & Tomorrow"
                  : tab === 'future'
                  ? "Future"
                  : "Past"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMoreOrders}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Load More Orders
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CateringOrders;


