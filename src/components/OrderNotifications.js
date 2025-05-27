// src/components/OrderNotifications.js
import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const OrderNotifications = () => {
  useEffect(() => {
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted');
        
        // Get Firebase messaging instance
        const messaging = getMessaging();
        
        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey: 'YOUR_VAPID_KEY' // Get this from Firebase Console
        });
        
        if (token) {
          console.log('FCM Token:', token);
          
          // Subscribe to order alerts
          await subscribeToOrderAlerts(token);
          
          // Listen for foreground messages
          onMessage(messaging, (payload) => {
            console.log('Order notification received:', payload);
            
            // Show browser notification
            if (payload.notification) {
              showOrderNotification(payload.notification, payload.data);
            }
            
            // Also show enhanced in-app notification with order details
            if (payload.data && payload.data.type === 'new-order') {
              showEnhancedOrderAlert(payload.data);
            }
          });
          
        } else {
          console.log('No FCM token available');
        }
      } else {
        console.log('Notification permission denied');
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  const subscribeToOrderAlerts = async (token) => {
    try {
      const response = await fetch('/api/subscribeToOrderAlerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });
      
      if (response.ok) {
        console.log('Subscribed to order alerts');
      }
    } catch (error) {
      console.error('Error subscribing to order alerts:', error);
    }
  };

  const showOrderNotification = (notification, data) => {
    // Show browser notification
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: 'new-order',
          requireInteraction: true, // Keeps notification visible
          actions: [
            {
              action: 'view',
              title: 'View Order'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ],
          data: data
        });
      });
    }

    // Also show in-app notification (optional)
    showInAppAlert(notification);
  };

  const showInAppAlert = (notification) => {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    toast.innerHTML = `
      <div class="flex items-center">
        <div class="flex-1">
          <div class="font-semibold">${notification.title}</div>
          <div class="text-sm opacity-90">${notification.body}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
          ✕
        </button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 10000);
    
    // Play notification sound (optional)
    playNotificationSound();
  };

  const showEnhancedOrderAlert = (orderData) => {
    // Create enhanced order notification with details
    const alert = document.createElement('div');
    alert.className = 'fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-xl z-50 max-w-sm border-l-4 border-yellow-400';
    alert.innerHTML = `
      <div class="flex items-start">
        <div class="flex-1">
          <div class="font-bold text-lg">🍽️ New Order!</div>
          <div class="mt-2 space-y-1 text-sm">
            <div><strong>Order:</strong> #${orderData.orderNumber}</div>
            <div><strong>Customer:</strong> ${orderData.customerName}</div>
            <div><strong>Boat:</strong> ${orderData.boatName}</div>
            <div><strong>Total:</strong> €${orderData.totalAmount} (${orderData.itemCount} items)</div>
            ${orderData.specialNotes ? `<div><strong>Notes:</strong> ${orderData.specialNotes}</div>` : ''}
          </div>
          <div class="mt-3 flex gap-2">
            <button onclick="window.location.href='/orders'" class="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100">
              View Orders
            </button>
            <button onclick="this.parentElement.parentElement.parentElement.remove()" class="bg-blue-700 text-white px-3 py-1 rounded text-sm hover:bg-blue-800">
              Dismiss
            </button>
          </div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200 text-lg">
          ✕
        </button>
      </div>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-remove after 15 seconds (longer for enhanced notification)
    setTimeout(() => {
      if (alert.parentElement) {
        alert.remove();
      }
    }, 15000);
    
    // Play notification sound
    playNotificationSound();
  };

  const playNotificationSound = () => {
    try {
      // You can add a notification sound file to your public folder
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => console.log('Could not play notification sound'));
    } catch (error) {
      console.log('Notification sound not available');
    }
  };

  return null; // This component doesn't render anything
};

export default OrderNotifications;