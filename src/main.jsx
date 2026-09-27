import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CSS_VARS } from './lib/theme'
import { readThemeMode, applyThemeMode } from './lib/themeMode'
import App from './App.jsx'

// index.css is written entirely against CSS custom properties; this is where they get their
// values, generated from lib/theme.js so tokens can never drift between JS and CSS. Injected
// before the first render so nothing paints unstyled.
const tokens = document.createElement('style')
tokens.textContent = CSS_VARS
document.head.appendChild(tokens)

// Before the first render, not inside it: a person who chose dark should never see a white flash
// on the way to it. With nothing stored this is a no-op and the media query above decides.
applyThemeMode(readThemeMode())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
