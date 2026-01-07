
// Testing ONLY BrowserRouter (not AppRoutes)
import { BrowserRouter } from 'react-router-dom';
import i18n from './i18n';

function App() {
  console.log('App rendering with BrowserRouter only');

  return (
    <div style={{ padding: 20 }}>
      <h1>✅ Testing: BrowserRouter Only</h1>
      <p>If you see this, BrowserRouter is fine. Problem is in AppRoutes.</p>
    </div>
  );
}

export default App;
