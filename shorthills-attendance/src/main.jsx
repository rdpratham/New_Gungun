import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function hideSplash() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => { splash.style.display = 'none'; }, 500);
  }
}

function showCrash() {
  const splash = document.getElementById('splash');
  const crash  = document.getElementById('crash');
  if (splash) splash.style.display = 'none';
  if (crash)  crash.style.display  = 'flex';
}

try {
  const root = document.getElementById('root');
  if (!root) throw new Error('root element missing');

  createRoot(root).render(
    <StrictMode>
      <App onMounted={hideSplash} />
    </StrictMode>,
  );

  // Fallback: hide splash after 6 s even if onMounted never fires
  setTimeout(hideSplash, 6000);
} catch (err) {
  console.error('Fatal render error:', err);
  showCrash();
}
