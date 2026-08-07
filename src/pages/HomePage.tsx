export const HomePage = () => {
  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '36px', marginBottom: '16px', color: '#333' }}>
          Добро пожаловать в Crimson Phoenix
        </h1>
        <p style={{ fontSize: '20px', color: '#666', marginBottom: '32px' }}>
          Ваш надежный партнер в мире цифровых решений
        </p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginTop: '48px'
        }}>
          <div className="card">
            <h3 style={{ marginBottom: '8px', color: '#333' }}>Безопасность</h3>
            <p style={{ color: '#666' }}>Надежная защита ваших данных</p>
          </div>
          
          <div className="card">
            <h3 style={{ marginBottom: '8px', color: '#333' }}>Скорость</h3>
            <p style={{ color: '#666' }}>Мгновенная обработка запросов</p>
          </div>
          
          <div className="card">
            <h3 style={{ marginBottom: '8px', color: '#333' }}>Надежность</h3>
            <p style={{ color: '#666' }}>Стабильная работа 24/7</p>
          </div>
        </div>
      </div>
    </div>
  );
};