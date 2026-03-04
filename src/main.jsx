import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { LangProvider } from './i18n/LangContext';
import { DroneProfileProvider } from './context/DroneProfileContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <LangProvider>
        <DataProvider>
          <DroneProfileProvider>
            <App />
          </DroneProfileProvider>
        </DataProvider>
      </LangProvider>
    </HashRouter>
  </StrictMode>
);
