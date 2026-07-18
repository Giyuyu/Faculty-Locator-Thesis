import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
// Import our custom CSS
import './styles/scss/styles.scss'
import { applySavedTheme } from './utils/profileActions.js'

applySavedTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
