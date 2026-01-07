
// Testing Router imports
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import i18n from './i18n';

function App() {
  console.log('App rendering with Router imports');

  return (
    <div style={{ padding: 20 }}>
      <h1>✅ Testing: Router Imports</h1>
      <p>If you see this, Router is NOT the problem.</p>
    </div>
  );
}

export default App;
