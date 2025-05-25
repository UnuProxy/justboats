// public/firebase-messaging-sw.js
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// Import your existing Firebase config
// Note: Service workers can't access process.env, so you'll need to inject these values
// We'll handle this in the notification service setup
const firebaseConfig = {
  apiKey: self.FIREBASE_CONFIG?.apiKey,
  authDomain: self.FIREBASE_CONFIG?.authDomain,
  projectId: self.FIREBASE_CONFIG?.projectId,
  storageBucket: self.FIREBASE_CONFIG?.storageBucket,
  messagingSenderId: self.FIREBASE_CONFIG?.messagingSenderId,
  appId: self.FIREBASE_CONFIG?.appId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle background messages
onBackgroundMessage(messaging, (payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Order Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new order',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: payload.data?.orderId || 'general',
    data: payload.data,
    requireInteraction: true, // Keeps notification visible until user interacts
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    actions: [
      {
        action: 'view',
        title: 'View Order'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  // Show the notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'view') {
    // Open the app to orders page
    const orderId = event.notification.data?.orderId;
    const url = orderId 
      ? `${self.location.origin}/orders#${orderId}`
      : `${self.location.origin}/orders`;
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if app is already open
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                orderId: orderId
              });
              return client.focus();
            }
          }
          // If app is not open, open it
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
    );
  }
});

// Handle push events for custom notification types
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  if (!event.data) return;

  try {
    const data = event.data.json();
    console.log('Push data:', data);
    
    // Handle different notification types for your catering orders
    let title, body, actions;
    
    switch (data.type) {
      case 'new_order':
        title = 'New Catering Order!';
        body = `Order #${data.orderId} from ${data.customerName}`;
        actions = [
          { action: 'view', title: 'View Order' },
          { action: 'prepare', title: 'Start Preparing' }
        ];
        break;
      case 'order_ready':
        title = 'Order Ready for Pickup';
        body = `Order #${data.orderId} is ready`;
        actions = [
          { action: 'view', title: 'View Order' },
          { action: 'notify_customer', title: 'Notify Customer' }
        ];
        break;
      case 'order_dispatched':
        title = 'Order Dispatched';
        body = `Order #${data.orderId} has been dispatched`;
        actions = [
          { action: 'view', title: 'Track Order' }
        ];
        break;
      default:
        title = data.title || 'New Notification';
        body = data.body || 'You have a new notification';
        actions = [{ action: 'view', title: 'View' }];
    }
    
    const options = {
      body: body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `order-${data.orderId}`,
      data: data,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      actions: actions
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('Error handling push event:', error);
  }
});