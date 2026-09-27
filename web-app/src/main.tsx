import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Fonts are bundled and served with the app (no Google Fonts request): the
// console keeps its typography offline and on networks that block Google.
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import './styles/tokens.css'
import './styles/global.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/pages.css'
import './styles/admin.css'
import './styles/boutique.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)