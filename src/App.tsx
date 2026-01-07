
// Testing i18n import first (most likely culprit)
import i18n from './i18n';

function App() {
  console.log('App rendering, i18n loaded:', !!i18n);

  return (
    <div style={{ padding: 20 }}>
      <h1>✅ Testing: i18n Import</h1>
      <p>If you see this, i18n is NOT the problem.</p>
    </div>
  );
}

export default App;
