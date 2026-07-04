import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './SameerSpecial.css'
import App from './App.jsx'

// Deploy Sync: 2026-05-15 - OUTLET Portal Fixes

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
