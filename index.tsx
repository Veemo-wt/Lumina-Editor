import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { initConsoleCapture } from './utils/consoleCapture';

// Inicjalizuj przechwytywanie logów konsoli (do feedbacku)
initConsoleCapture();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/:sessionId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);