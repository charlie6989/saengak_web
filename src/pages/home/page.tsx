import Header from '../../components/feature/Header';

export default function Home() {
  console.log('🏠 Testing with Header');

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <Header />
      <div style={{ padding: 50, fontSize: 30, background: 'lime', color: 'black' }}>
        <h1>Home with Header</h1>
        <p>If you see this, Header is OK. Will test Footer next.</p>
      </div>
    </div>
  );
}
