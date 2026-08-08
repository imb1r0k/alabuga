import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Zap, CheckCircle, ArrowRight, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getPublicBuildings } from '../services/api';
import { PublicFloorMap } from '../components/PublicFloorMap';
import { BookingModal } from '../components/BookingModal';

export const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { hero } = useSettings();

  // Бронирование
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedBuildingName, setSelectedBuildingName] = useState('');
  const [selectedFloorNumber, setSelectedFloorNumber] = useState(0);
  const [loadingBuildings, setLoadingBuildings] = useState(false);

  useEffect(() => {
    getPublicBuildings()
      .then((data) => {
        setBuildings(data);
        if (data.length > 0) {
          setSelectedBuildingId(data[0].id);
          setSelectedBuildingName(data[0].name);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingBuildings(false));
  }, []);

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setSelectedBuildingId(id);
    const b = buildings.find((b) => b.id === id);
    setSelectedBuildingName(b?.name || '');
    setSelectedRoom(null);
  };

  const handleRoomSelect = (room: any, building: any, floor: any) => {
    setSelectedRoom(room);
    setSelectedBuildingName(building.name);
    setSelectedFloorNumber(floor.floor_number);
  };

  return (
    <div style={{ padding: '32px 24px', width: '100%' }}>
      {/* Hero секция */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '36px 28px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '640px' }}>
          {hero.hero_badge && (
            <span style={{
              display: 'inline-block',
              backgroundColor: 'rgba(56, 189, 248, 0.2)',
              color: '#7dd3fc',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '20px',
              marginBottom: '16px'
            }}>
              {hero.hero_badge}
            </span>
          )}
          <h1
            style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px', lineHeight: 1.2 }}
            dangerouslySetInnerHTML={{ __html: hero.hero_title }}
          />
          <p style={{ color: '#cbd5e1', fontSize: '16px', marginBottom: '32px', lineHeight: 1.6 }}>
            {hero.hero_description}
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="btn btn-primary"
                style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '15px', textDecoration: 'none', gap: '8px' }}
              >
                <span>{hero.hero_button_text_auth}</span>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                to="/auth"
                className="btn btn-primary"
                style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '15px', textDecoration: 'none', gap: '8px' }}
              >
                <span>{hero.hero_button_text}</span>
                <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Карточки преимуществ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Shield size={24} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Безопасность</h3>
          <p style={{ fontSize: '14px', color: '#475569' }}>Надежная защита данных и распределение ролей участников форума.</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Zap size={24} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Скорость и интерактивность</h3>
          <p style={{ fontSize: '14px', color: '#475569' }}>Наглядные интерактивные схемы корпусов и моментальная обработка заявок.</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <CheckCircle size={24} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Командная работа</h3>
          <p style={{ fontSize: '14px', color: '#475569' }}>Общие чаты, календари событий и совместное расселение команд.</p>
        </div>
      </div>

      {/* Блок бронирования комнаты */}
      <div className="card" style={{ marginBottom: '48px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>Выберите комнату</h2>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Просмотрите доступные комнаты в корпусах и нажмите на интересующую для бронирования.</p>
        </div>

        {loadingBuildings ? (
          <p>Загрузка корпусов...</p>
        ) : buildings.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Корпуса ещё не созданы. Загляните позже.</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={18} color="#0284c7" />
                Корпус:
              </label>
              <select
                value={selectedBuildingId || ''}
                onChange={handleBuildingChange}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', minWidth: '200px' }}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {selectedBuildingId && (
              <PublicFloorMap
                buildingId={selectedBuildingId}
                onRoomSelect={handleRoomSelect}
              />
            )}
          </>
        )}
      </div>

      {/* Модальное окно бронирования */}
      {selectedRoom && (
        <BookingModal
          room={selectedRoom}
          buildingName={selectedBuildingName}
          floorNumber={selectedFloorNumber}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </div>
  );
};