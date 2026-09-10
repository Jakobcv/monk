import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CSS_VARS } from './lib/theme'
import App from './App.jsx'

// index.css is written entirely against CSS custom properties; this is where they get their
// values, generated from lib/theme.js so tokens can never drift between JS and CSS. Injected
// before the first render so nothing paints unstyled.
const tokens = document.createElement('style')
tokens.textContent = CSS_VARS
document.head.appendChild(tokens)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
