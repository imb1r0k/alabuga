import React, { useState, useEffect } from 'react';
import { Bed, ArrowUpDown, Wrench } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { getPublicLayout } from '../services/api';
import { useOrientation } from '../hooks/useOrientation';

const StairsIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19h4v-4h4v-4h4V7h4" />
    <path d="M4 19v-4" opacity="0.4" />
    <path d="M8 15v-4" opacity="0.4" />
    <path d="M12 11v-4" opacity="0.4" />
  </svg>
);

interface Room {
  id: number;
  room_number: string;
  name: string;
  capacity: number;
  is_technical: number;
  room_type: string;
  gender: string;
  x_pos: number;
  y_pos: number;
  occupied: number;
}

interface Floor {
  id: number;
  floor_number: number;
  width: number;
  start_room_number: number | null;
  room_order_type: string;
  gender: string;
  rooms: Room[];
}

interface Building {
  id: number;
  name: string;
  gender: string;
}

interface PublicLayoutData {
  building: Building;
  floors: Floor[];
}

interface PublicFloorMapProps {
  buildingId: number;
  onRoomSelect: (room: Room, building: Building, floor: Floor) => void;
}

const GenderBadge: React.FC<{ gender?: string; size?: number }> = ({ gender = 'MIXED', size = 18 }) => {
  let label = 'С';
  let bg = '#8b5cf6';
  if (gender === 'M') { label = 'М'; bg = '#0284c7'; }
  else if (gender === 'F') { label = 'Ж'; bg = '#e11d48'; }
  return (
    <span title={`Пол: ${gender === 'M' ? 'Мужской' : gender === 'F' ? 'Женский' : 'Смешанный'}`}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: bg, color: '#fff', fontSize: `${Math.round(size*0.55)}px`, fontWeight: 'bold', lineHeight: 1, flexShrink: 0 }}>
      {label}
    </span>
  );
};

export const PublicFloorMap: React.FC<PublicFloorMapProps> = ({ buildingId, onRoomSelect }) => {
  const [layout, setLayout] = useState<PublicLayoutData | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);

  const isPortrait = useOrientation();
  const showVertical = isPortrait;

  useEffect(() => {
    setLoading(true);
    setSelectedFloor(null);
    getPublicLayout(buildingId)
      .then((data) => {
        setLayout(data);
        if (data.floors.length > 0) {
          setSelectedFloor(data.floors[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [buildingId]);

  const floor = selectedFloor;
  const floorWidth = floor?.width || 8;

  const getCellIndex = (x: number, y: number, width: number, orderType: string = 'clockwise') => {
    if (orderType === 'column_wise') {
      return y === 0 ? x * 2 + 1 : x * 2 + 2;
    } else {
      return y === 0 ? x + 1 : width * 2 - x;
    }
  };

  const calculateFloorStartRoomNumber = (targetFloor: Floor, floors: Floor[]) => {
    if (targetFloor.start_room_number && Number(targetFloor.start_room_number) > 0) {
      return Number(targetFloor.start_room_number);
    }
    const lowerFloors = floors.filter((f) => Number(f.floor_number) < Number(targetFloor.floor_number));
    let start = 1;
    for (const lf of lowerFloors) {
      const cellsCount = (Number(lf.width) || 8) * 2;
      start += cellsCount;
    }
    return start;
  };

  const getCalculatedRoomNumber = (x: number, y: number) => {
    if (!floor) return 1;
    const width = Number(floor.width) || 8;
    const cellIdx = getCellIndex(x, y, width, floor.room_order_type || 'clockwise');
    const floorStart = calculateFloorStartRoomNumber(floor, layout?.floors || []);
    return floorStart + cellIdx - 1;
  };

  const renderCellTile = (x: number, y: number) => {
    const room = floor?.rooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === y);
    const calcRoomNum = getCalculatedRoomNumber(x, y);
    const bookedCount = room?.occupied || 0;
    const isFull = room && room.room_type === 'room' && bookedCount >= (room.capacity || 0);

    const tmpl = room ? (
      room.room_type === 'elevator' ? { icon: ArrowUpDown, bg: '#cff4fc', borderColor: '#9eeaf9', textColor: '#055160' } :
      room.room_type === 'stairs' ? { icon: StairsIcon, bg: '#fff3cd', borderColor: '#ffe69c', textColor: '#664d03' } :
      room.room_type === 'tech' ? { icon: Wrench, bg: '#e2e3e5', borderColor: '#c4c8cb', textColor: '#41464b' } :
      isFull ? { icon: Bed, bg: '#fee2e2', borderColor: '#fca5a5', textColor: '#991b1b' } :
      { icon: Bed, bg: '#d1e7dd', borderColor: '#a3cfbb', textColor: '#0f5132' }
    ) : null;

    const IconComp = tmpl?.icon || Bed;
    const clickable = room && room.room_type === 'room' && !isFull;

    return (
      <div
        key={`cell-${x}-${y}`}
        onClick={() => {
          if (clickable && layout?.building && floor) {
            onRoomSelect(room, layout.building, floor);
          }
        }}
        title={isFull ? 'Комната полностью заполнена' : undefined}
        style={{
          height: '110px',
          width: '100%',
          border: room ? `2px solid ${tmpl?.borderColor || '#0284c7'}` : '2px dashed #cbd5e1',
          borderRadius: '8px',
          backgroundColor: room ? (tmpl?.bg || '#e0f2fe') : '#ffffff',
          color: tmpl?.textColor || '#0369a1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: clickable ? 'pointer' : 'not-allowed',
          fontSize: '13px',
          padding: '4px',
          textAlign: 'center',
          position: 'relative',
          transition: 'all 0.15s ease',
        }}
      >
        {room && room.room_type === 'room' && (
          <div style={{ position: 'absolute', top: '3px', right: '4px' }}>
            <GenderBadge gender={room.gender} size={18} />
          </div>
        )}

        {room ? (
          <div style={{ transform: showVertical ? 'rotate(90deg)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <IconComp size={24} style={{ marginBottom: '3px', marginTop: '4px' }} />
            <strong>{room.room_number || room.name}</strong>

            {room.room_type === 'room' && (
              <span style={{ fontSize: '12px', marginTop: '2px', fontWeight: 600, color: isFull ? '#991b1b' : '#16a34a' }}>
                {isFull ? `Заполнено (${bookedCount}/${room.capacity})` : `${bookedCount} / ${room.capacity}`}
              </span>
            )}
          </div>
        ) : (
          <div style={{ transform: showVertical ? 'rotate(90deg)' : 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', display: 'block', fontWeight: 'bold', color: '#cbd5e1' }}>№ {calcRoomNum}</span>
            Свободно
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <Skeleton width="100%" height={300} />;
  }

  if (!layout || !floor) {
    return <p style={{ color: '#94a3b8' }}>Корпус не найден или в нём нет этажей.</p>;
  }

  const cellSize = 145;
  const corridorHeight = 40;
  const gridGap = 10;
  const gridHeight = 110 * 2 + corridorHeight + gridGap * 2;
  const gridWidth = floorWidth * cellSize + (floorWidth - 1) * gridGap;

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {layout.floors.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFloor(f)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: selectedFloor?.id === f.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
              backgroundColor: selectedFloor?.id === f.id ? '#e0f2fe' : '#fff',
              color: selectedFloor?.id === f.id ? '#0369a1' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Этаж {f.floor_number}
          </button>
        ))}
      </div>

      <div className="w-full overflow-auto py-2">
        {showVertical ? (
          <div style={{
            width: gridHeight,
            height: gridWidth,
            position: 'relative',
            margin: '0 auto',
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: gridWidth,
              height: gridHeight,
              transform: 'translate(-50%, -50%) rotate(-90deg)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${floorWidth}, ${cellSize}px)`, gap: gridGap, justifyContent: 'start' }}>
                {Array.from({ length: floorWidth }).map((_, x) => renderCellTile(x, 0))}

                <div style={{
                  gridColumn: `1 / span ${floorWidth}`,
                  height: corridorHeight,
                  backgroundColor: '#e2e8f0',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  letterSpacing: '2px',
                }}>
                  <span style={{ transform: 'rotate(90deg)', whiteSpace: 'nowrap' }}>КОРИДОР</span>
                </div>

                {Array.from({ length: floorWidth }).map((_, x) => renderCellTile(x, 2))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${floorWidth}, ${cellSize}px)`, gap: gridGap, justifyContent: 'start' }}>
            {Array.from({ length: floorWidth }).map((_, x) => renderCellTile(x, 0))}

            <div style={{
              gridColumn: `1 / span ${floorWidth}`,
              height: corridorHeight,
              backgroundColor: '#e2e8f0',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              fontWeight: 'bold',
              fontSize: '11px',
              letterSpacing: '2px',
            }}>
              КОРИДОР
            </div>

            {Array.from({ length: floorWidth }).map((_, x) => renderCellTile(x, 2))}
          </div>
        )}
      </div>
    </div>
  );
};