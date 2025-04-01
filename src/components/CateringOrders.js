import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/firebaseConfig';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  limit,
  startAfter,
  getDocs,
} from 'firebase/firestore';
import { CheckCircle, XCircle, Search, X, Printer, Plus, Trash2 } from 'lucide-react';
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
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersData);
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
    const newOrders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setOrders([...orders, ...newOrders]);
    setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    setHasMore(snapshot.docs.length === ORDERS_PER_PAGE);
  };

  const handleManualOrderAdded = (newOrder) => {
    // Refresh orders list or add the new order to the top
    setOrders([newOrder, ...orders]);
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
  
  const deleteOrder = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
        // Remove the order from local state
        setOrders(orders.filter(order => order.id !== orderId));
      } catch (error) {
        console.error('Error deleting order:', error);
        alert('Failed to delete order. Please try again.');
      }
    }
  };

  const getOrderStatus = (order) => order.status || order.paymentStatus || 'unknown';

  const filterOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(order => 
        (order.orderId && order.orderId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.id && order.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.boatName && order.boatName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.fullName && order.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(
        order => getOrderStatus(order).toLowerCase() === selectedStatus.toLowerCase()
      );
    }

    // Date filtering based on active tab
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

  // Print Order Component
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
            <div><strong>Email:</strong> {order.customerEmail}</div>
            <div><strong>Order Date:</strong> {order.orderDate}</div>
          </div>
        </div>

        {order.items && order.items.length > 0 && (
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
                {order.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{item.name}</td>
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

          {/* Products Section */}
          {order.items && order.items.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <h4 className="font-medium mb-2">Products Ordered:</h4>
              <div className="space-y-2">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <div className="flex-1 min-w-0 mr-2">
                      <span className="font-medium block truncate">{item.name}</span>
                      <span className="text-gray-500 text-sm">x{item.quantity}</span>
                    </div>
                    <span className="text-gray-700 whitespace-nowrap">
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

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-end gap-2 mt-4">
            {/* Delete Button */}
            <button
              onClick={() => deleteOrder(order.id)}
              className="flex items-center px-3 py-1.5 bg-red-700 text-white rounded hover:bg-red-800 text-sm"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>
            
            {/* Print Button */}
            <button
              onClick={() => handlePrint(order)}
              className="flex items-center px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
            >
              <Printer className="w-4 h-4 mr-1" />
              Print
            </button>

            {/* Status Update Buttons */}
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
        
        {/* Hidden print template */}
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
      {/* Modal for manual order entry */}
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
      
      {/* Header section with search and filters */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Orders Dashboard</h1>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Add Manual Order Button */}
            <button
              onClick={() => setShowManualOrderForm(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5 mr-1" />
              Add Manual Order
            </button>
            
            {/* Search bar */}
            <div className="w-full sm:w-auto relative">
              <input
                type="text"
                placeholder="Search order #, boat, client..."
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
          {/* Status Filter */}
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

          {/* Date filter tabs */}
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

      {/* Orders List */}
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

