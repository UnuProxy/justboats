import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/firebaseConfig';
import { Bell, CreditCard, Gift, Calendar, User, AlertCircle, Clock, Ship, CheckCircle } from 'lucide-react';

const NotificationsCenter = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        read: doc.data().read || false
      }));
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, { read: true });
      });

      await batch.commit();
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.read) {
        await updateDoc(doc(db, 'notifications', notification.id), {
          read: true
        });
      }
      setIsOpen(false);

      switch (notification.type) {
        case 'booking':
          if (notification.bookingId) {
            navigate(`/bookings/${notification.bookingId}`);
          }
          break;
        case 'payment':
          if (notification.link?.includes('payment-tracking')) {
            const bookingId = new URLSearchParams(notification.link.split('?')[1]).get('booking');
            if (bookingId) {
              navigate('/payment-tracking', {
                state: { selectedBookingId: bookingId }
              });
            }
          }
          break;
        case 'transfer':
          if (notification.link?.includes('bookings')) {
            const params = new URLSearchParams(notification.link.split('?')[1]);
            const bookingId = params.get('id');
            const tab = params.get('tab');
            if (bookingId) {
              navigate('/bookings', {
                state: { 
                  selectedBookingId: bookingId,
                  activeTab: tab || 'details'
                }
              });
            }
          }
          break;
        case 'client':
          navigate('/clients');
          break;
        default:
          if (notification.link) {
            navigate(notification.link);
          }
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'payment': return <CreditCard className="text-green-500" />;
      case 'birthday': return <Gift className="text-purple-500" />;
      case 'booking': return <Calendar className="text-blue-500" />;
      case 'client': return <User className="text-orange-500" />;
      case 'transfer': return <Ship className="text-cyan-500" />;
      case 'reminder': return <Clock className="text-yellow-500" />;
      default: return <AlertCircle className="text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed md:absolute top-0 md:top-auto right-0 mt-16 md:mt-2 w-full md:w-96 bg-white rounded-lg shadow-xl z-50 max-h-[90vh] md:max-h-[600px] overflow-hidden">
          <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="text-sm text-gray-500">
                    {unreadCount} unread
                  </span>
                )}
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark all read
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-[calc(90vh-4rem)] md:max-h-[500px]">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b hover:bg-gray-50 cursor-pointer flex items-start gap-3 ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="md:hidden p-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsCenter;