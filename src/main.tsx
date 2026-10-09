// Geist is the fallback for San Francisco on non-Apple devices (index.css).
import '@fontsource-variable/geist';
import './styles/index.css';
// Catches the browser's install prompt before any screen offering it has loaded.
import './lib/install';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
