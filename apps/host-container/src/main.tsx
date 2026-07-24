import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('❌ CRITICAL: Failed to find the root element in index.html');
}

// Entry script that index.html is looking for. Its only job is to grab the HTML element with id="root" and render your new App component inside it
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);