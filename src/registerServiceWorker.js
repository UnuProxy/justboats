export function register() {
    if ('serviceWorker' in navigator) {
      // Wait for the page to load
      window.addEventListener('load', () => {
        const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
        
        registerValidSW(swUrl);
        
        // Handle updates if available
        handleServiceWorkerUpdates();
      });
    }
  }
  
  function registerValidSW(swUrl) {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        // Registration successful
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;
  
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content is available
                console.log('New content is available and will be used when all tabs for this page are closed.');
              } else {
                // Content is cached for offline use
                console.log('Content is cached for offline use.');
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('Error during service worker registration:', error);
      });
  }
  
  function handleServiceWorkerUpdates() {
    // Check for service worker updates every hour
    setInterval(() => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATES' });
      }
    }, 3600000); // 1 hour
  
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Reload the page when the service worker is updated
      window.location.reload();
    });
  }
  
  export function unregister() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.unregister();
        })
        .catch((error) => {
          console.error(error.message);
        });
    }
  }