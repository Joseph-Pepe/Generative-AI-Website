import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Or import { GeneratorStudio as App } from './components/GeneratorStudio';

// Allows us to be able to open http://localhost:3001 in a browser window to test the audio generator by itself (without loading the entire Host Container).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);