import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthGate from './AuthGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>{(user, users, onSaveUsers) => <App currentUser={user} users={users} onSaveUsers={onSaveUsers} />}</AuthGate>
  </StrictMode>,
)
