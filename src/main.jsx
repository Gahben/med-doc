import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import './styles/global.css'

// Debug: verificar se há duas cópias do React
console.log('React version:', React.version)
console.log('Is AuthProvider a function?', typeof AuthProvider)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              background: '#1a1916',
              color: '#fff',
              borderRadius: '10px',
              padding: '12px 16px',
            },
            success: { iconTheme: { primary: '#1d5c3a', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#c0392b', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)