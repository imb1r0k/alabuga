import React from 'react';
import { X, Users, Bed, MapPin, KeyRound, UserCheck } from 'lucide-react';

interface Occupant {
  first_name: string;
  last_name: string;
  patronymic?: string;
  login: string;
}

interface RoomInfoModalProps {
  room: any;
  buildingName: string;
  floorNumber: number;
  onClose: () => void;
  onProceedToBooking: () => void;
}

export const RoomInfoModal: React.FC<RoomInfoModalProps> = ({
  room,
  buildingName,
  floorNumber,
  onClose,
  onProceedToBooking,
}) => {
  const occupants: Occupant[] = room.occupants || [];
  const capacity = room.capacity || 0;
  const occupiedCount = room.occupied || occupants.length || 0;
  const freeSeats = capacity - occupiedCount;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'toastIn 0.2s ease',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          position: 'relative',
          padding: '24px',
        }}
      >
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            border: 'none',
            background: '#f1f5f9',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
          }}
        >
          <X size={18} />
        </button>

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bed size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 700 }}>
              Комната №{room.room_number || room.name}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={14} color="#0284c7" />
              {buildingName} — Этаж {floorNumber}
            </p>
          </div>
        </div>

        {/* Информационная сводка мест */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Вместимость:</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{capacity} чел.</div>
          </div>

          <div style={{ height: '30px', width: '1px', backgroundColor: '#cbd5e1' }} />

          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Занято мест:</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0284c7' }}>{occupiedCount} чел.</div>
          </div>

          <div style={{ height: '30px', width: '1px', backgroundColor: '#cbd5e1' }} />

          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Свободно:</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: freeSeats > 0 ? '#16a34a' : '#ef4444' }}>
              {freeSeats > 0 ? `${freeSeats} мест` : 'Заполнено'}
            </div>
          </div>
        </div>

        {/* Список уже заселившихся участников */}
        <div style={{ marginBottom: '24px' }}>
          <h4
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Users size={18} color="#0284c7" />
            Проживающие участники ({occupants.length})
          </h4>

          {occupants.length === 0 ? (
            <div
              style={{
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '14px',
              }}
            >
              В этой комнате пока никто не проживает. Вы будете первыми! 🎉
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {occupants.map((occ, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      flexShrink: 0,
                    }}
                  >
                    {(occ.last_name?.[0] || occ.first_name?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                      {occ.last_name} {occ.first_name} {occ.patronymic || ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Подтверждённое проживание <UserCheck size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#16a34a' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Кнопка бронирования */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onProceedToBooking}
            disabled={freeSeats <= 0}
            className="btn btn-primary"
            style={{
              flex: 1,
              padding: '12px 18px',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: freeSeats <= 0 ? 0.55 : 1,
              cursor: freeSeats <= 0 ? 'not-allowed' : 'pointer',
              backgroundColor: freeSeats <= 0 ? '#94a3b8' : undefined,
              borderColor: freeSeats <= 0 ? '#94a3b8' : undefined,
            }}
          >
            <KeyRound size={18} />
            {freeSeats > 0 ? 'Забронировать место' : 'Все места заняты'}
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '12px 18px', fontSize: '15px', borderRadius: '10px' }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};