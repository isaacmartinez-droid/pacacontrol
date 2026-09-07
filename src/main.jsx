import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PacaDataProvider } from './context/PacaDataContext'
import { AlertsProvider } from './context/AlertsContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PacaDataProvider>
          <AlertsProvider>
            <App />
          </AlertsProvider>
        </PacaDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
