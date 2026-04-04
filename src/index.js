import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { unregister } from './registerServiceWorker';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
<React.StrictMode>
<App />
</React.StrictMode>
);

// Disable the custom service worker because it interferes with brochure/image requests.
unregister();

reportWebVitals();






