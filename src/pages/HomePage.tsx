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

  const handleBuildingSelect = (building: any) => {
    setSelectedBuildingId(building.id);
    setSelectedBuildingName(building.name);
    setSelectedRoom(null);
  };

  const handleRoomSelect = (room: any, building: any, floor: any) => {
    setSelectedRoom(room);
    setSelectedBuildingName(building.name);
    setSelectedFloorNumber(floor.floor_number);
  };

  const getGenderLabel = (gender: string) => {
    if (gender === 'M') return 'Мальчики';
    if (gender === 'F') return 'Девочки';
    return 'Смешанный';
  };

  const getGenderColors = (gender: string) => {
    if (gender === 'M') {
      return { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e' };
    }
    if (gender === 'F') {
      return { bg: '#fce7f3', border: '#ec4899', text: '#831843' };
    }
    return { bg: '#f3e8ff', border: '#8b5cf6', text: '#6b21a8' };
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
            {/* Плитки выбора корпуса */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Building2 size={18} color="#0284c7" />
                Выберите корпус:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {buildings.map((b) => {
                  const isSelected = selectedBuildingId === b.id;
                  const leftPlaces = (b.total_capacity || 0) - (b.occupied_places || 0);
                  const colors = getGenderColors(b.gender);
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleBuildingSelect(b)}
                      style={{
                        backgroundColor: colors.bg,
                        border: `2px solid ${isSelected ? '#0284c7' : colors.border}`,
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 4px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
                        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: colors.text, marginBottom: '6px' }}>{b.name}</div>
                      <div style={{ fontSize: '13px', color: colors.text, opacity: 0.8 }}>{getGenderLabel(b.gender)}</div>
                      <div style={{ fontSize: '14px', color: colors.text, fontWeight: 600, marginTop: '8px' }}>
                        Осталось {leftPlaces} из {b.total_capacity || 0} мест
                      </div>
                    </div>
                  );
                })}
              </div>
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