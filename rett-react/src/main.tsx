import React from 'react';
import ReactDOM from 'react-dom/client';
import AccessGate from './components/AccessGate';
import App from './App';
import './styles/app.css';
// Brand theme + modern UX layer. Imported AFTER app.css so its token
// overrides and component polish win the cascade. Fully sync-safe — it only
// overrides upstream :root tokens + class hooks, never touches the synced
// /legacy/css/styles.css. See the file header for the full rationale.
import './styles/brand-theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccessGate>
      <App />
    </AccessGate>
  </React.StrictMode>,
);
