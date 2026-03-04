import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const RESIZE_OBSERVER_NOISE = [
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
];

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  if (typeof window.ResizeObserver === 'function') {
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class ResizeObserverRaf extends NativeResizeObserver {
      constructor(callback) {
        super((entries, observer) => {
          window.requestAnimationFrame(() => callback(entries, observer));
        });
      }
    };
  }

  const suppressResizeObserverRuntimeNoise = (event) => {
    const message = String(
      event?.message ||
      event?.error?.message ||
      event?.reason?.message ||
      event?.reason ||
      ''
    );

    if (RESIZE_OBSERVER_NOISE.some((text) => message.includes(text))) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    }
  };

  // CRA dev overlay reports this browser noise as a runtime error.
  // Use capture so this runs before the overlay listeners.
  window.addEventListener('error', suppressResizeObserverRuntimeNoise, true);
  window.addEventListener('unhandledrejection', suppressResizeObserverRuntimeNoise, true);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const appTree = process.env.NODE_ENV === 'development'
  ? <App />
  : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

root.render(appTree);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
