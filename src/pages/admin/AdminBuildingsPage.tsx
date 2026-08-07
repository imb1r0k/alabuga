import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import {
  getAdminBuildings,
  saveAdminBuilding,
  getAdminFloors,
  saveAdminFloor,
  getAdminRooms,
  saveAdminRoom,
} from '../../services/api';
import { 
  Bed, 
  ArrowUpDown, 
  Footprints, 
  Wrench, 
  Plus, 
  Sparkles, 
  Trash2, 
  Check, 
  Compass,
  Play,
  RotateCw,
  SquareCheck
} from 'lucide-react';

type TileType = 'room' | 'elevator' | 'stairs' | 'tech';

interface TileTemplate {
  type: TileType;
  title: string;
  icon: React.ElementType;
  bg: string;
  borderColor: string;
  textColor: string;
}

const TILE_TEMPLATES: TileTemplate[] = [
  { type: 'room', title: 'Комната', icon: Bed, bg: '#d1e7dd', borderColor: '#a3cfbb', textColor: '#0f5132' },
  { type: 'elevator', title: 'Лифт', icon: ArrowUpDown, bg: '#cff4fc', borderColor: '#9eeaf9', textColor: '#055160' },
  { type: 'stairs', title: 'Лестница', icon: Footprints, bg: '#fff3cd', borderColor: '#ffe69c', textColor: '#664d03' },
  { type: 'tech', title: 'Техническая', icon: Wrench, bg: '#e2e3e5', borderColor: '#c4c8cb', textColor: '#41464b' },
];

export const AdminBuildingsPage: React.FC = () => {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  
  // Добавление здания
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingGender, setNewBuildingGender] = useState<'M' | 'F' | 'MIXED'>('MIXED');

  // Активный инструмент заготовки
  const [selectedTool, setSelectedTool] = useState<TileType>('room');

  // Генератор комнат
  const [showGenModal, setShowGenModal] = useState(false);
  const [genStartNumber, setGenStartNumber] = useState(101);
  const [genDirection, setGenDirection] = useState<'cw' | 'ccw'>('cw'); // по часовой / против

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    setBuildingsLoading(true);
    try {
      const bData = await getAdminBuildings();
      setBuildings(bData);
      if (bData.length > 0) {
        handleSelectBuilding(bData[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBuildingsLoading(false);
    }
  };

  const handleSelectBuilding = async (b: any) => {
    setSelectedBuilding(b);
    setSelectedRoom(null);
    try {
      const fData = await getAdminFloors(b.id);
      setFloors(fData);
      if (fData.length > 0) {
        handleSelectFloor(fData[0]);
      } else {
        setSelectedFloor(null);
        setRooms([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectFloor = async (f: any) => {
    setSelectedFloor(f);
    setSelectedRoom(null);
    try {
      const rData = await getAdminRooms(f.id);
      setRooms(rData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuildingName.trim()) return;
    setSavingBuilding(true);
    try {
      await saveAdminBuilding({ name: newBuildingName, gender: newBuildingGender });
      setNewBuildingName('');
      loadBuildings();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBuilding(false);
    }
  };

  // По умолчанию создается пустой этаж
  const handleAddFloor = async () => {
    if (!selectedBuilding) return;
    const nextNum = floors.length + 1;
    try {
      await saveAdminFloor({
        building_id: selectedBuilding.id,
        floor_number: nextNum,
        width: 8,
        gender: 'DEFAULT',
      });
      handleSelectBuilding(selectedBuilding);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFloorWidth = async (newWidth: number) => {
    if (!selectedFloor || newWidth < 3 || newWidth > 20) return;
    try {
      await saveAdminFloor({ ...selectedFloor, width: newWidth });
      setSelectedFloor({ ...selectedFloor, width: newWidth });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFloorGender = async (gender: string) => {
    if (!selectedFloor) return;
    try {
      await saveAdminFloor({ ...selectedFloor, gender });
      setSelectedFloor({ ...selectedFloor, gender });
    } catch (err) {
      console.error(err);
    }
  };

  // Вспомогательная функция обхода сетки по часовой стрелке
  const getClockwiseCells = (width: number) => {
    const cells: { x: number; y: number; index: number }[] = [];
    let idx = 1;

    // Верхняя линия (слева направо, y = 0)
    for (let x = 0; x < width; x++) {
      cells.push({ x, y: 0, index: idx++ });
    }
    // Нижняя линия (справа налево, y = 2)
    for (let x = width - 1; x >= 0; x--) {
      cells.push({ x, y: 2, index: idx++ });
    }
    return cells;
  };

  // Получить порядковый номер позиции плитки по часовой стрелке
  const getCellClockwiseIndex = (x: number, y: number, width: number) => {
    const cells = getClockwiseCells(width);
    const item = cells.find((c) => c.x === x && c.y === y);
    return item ? item.index : 1;
  };

  // Автонумерация комнаты
  const calculateAutoRoomNumber = (x: number, y: number, width: number, floorNum: number) => {
    const idx = getCellClockwiseIndex(x, y, width);
    const suffix = idx < 10 ? `0${idx}` : `${idx}`;
    return `${floorNum}${suffix}`;
  };

  // Клик по ячейке сетки макета
  const handleCellClick = async (x: number, y: number) => {
    if (y === 1 || !selectedFloor) return; // Коридор

    const width = selectedFloor.width || 8;
    const existing = rooms.find((r) => r.x_pos === x && r.y_pos === y);

    if (existing) {
      setSelectedRoom({ ...existing });
    } else {
      // Ставим выбранную заготовку
      const autoNum = calculateAutoRoomNumber(x, y, width, selectedFloor.floor_number);
      const isTech = selectedTool === 'tech' ? 1 : 0;

      const newRoom = {
        floor_id: selectedFloor.id,
        building_id: selectedBuilding.id,
        room_number: autoNum,
        name: selectedTool === 'room' ? `Комната ${autoNum}` :
              selectedTool === 'elevator' ? 'Лифт' :
              selectedTool === 'stairs' ? 'Лестница' : 'Техпомещение',
        capacity: selectedTool === 'room' ? 2 : 0,
        is_technical: isTech,
        room_type: selectedTool,
        gender: 'DEFAULT',
        x_pos: x,
        y_pos: y,
      };

      try {
        await saveAdminRoom(newRoom);
        handleSelectFloor(selectedFloor);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, type: TileType) => {
    e.dataTransfer.setData('text/plain', type);
  };

  const handleDrop = async (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    if (y === 1 || !selectedFloor) return;

    const droppedType = (e.dataTransfer.getData('text/plain') as TileType) || selectedTool;
    const width = selectedFloor.width || 8;
    const autoNum = calculateAutoRoomNumber(x, y, width, selectedFloor.floor_number);

    const existing = rooms.find((r) => r.x_pos === x && r.y_pos === y);

    const roomData = {
      id: existing?.id,
      floor_id: selectedFloor.id,
      building_id: selectedBuilding.id,
      room_number: existing?.room_number || autoNum,
      name: droppedType === 'room' ? `Комната ${autoNum}` :
            droppedType === 'elevator' ? 'Лифт' :
            droppedType === 'stairs' ? 'Лестница' : 'Техпомещение',
      capacity: droppedType === 'room' ? 2 : 0,
      is_technical: droppedType === 'tech' ? 1 : 0,
      room_type: droppedType,
      gender: existing?.gender || 'DEFAULT',
      x_pos: x,
      y_pos: y,
    };

    try {
      await saveAdminRoom(roomData);
      handleSelectFloor(selectedFloor);
    } catch (err) {
      console.error(err);
    }
  };

  // Автогенерация комнат по часовой стрелке
  const handleRunAutoGeneration = async () => {
    if (!selectedFloor || !selectedBuilding) return;

    const width = selectedFloor.width || 8;
    const cells = getClockwiseCells(width);

    let startNum = genStartNumber || (selectedFloor.floor_number * 100 + 1);

    try {
      for (const cell of cells) {
        const roomNumber = `${startNum}`;
        startNum++;

        await saveAdminRoom({
          floor_id: selectedFloor.id,
          building_id: selectedBuilding.id,
          room_number: roomNumber,
          name: `Комната ${roomNumber}`,
          capacity: 2,
          is_technical: 0,
          room_type: 'room',
          gender: 'DEFAULT',
          x_pos: cell.x,
          y_pos: cell.y,
        });
      }
      setShowGenModal(false);
      handleSelectFloor(selectedFloor);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRoomDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setSavingRoom(true);
    try {
      await saveAdminRoom(selectedRoom);
      handleSelectFloor(selectedFloor);
      setSelectedRoom(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRoom(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ padding: '0 10px' }}>
        {buildingsLoading ? (
          <Skeleton width="100%" height={250} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>
            
            {/* Сайдбар выбора и создания корпуса */}
            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h4 style={{ fontSize: '16px', marginBottom: '14px', color: '#1e293b' }}>Список корпусов</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {buildings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBuilding(b)}
                    className={`btn ${selectedBuilding?.id === b.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      fontSize: '14px',
                      backgroundColor: selectedBuilding?.id === b.id ? '#0284c7' : '#f8fafc',
                      color: selectedBuilding?.id === b.id ? '#fff' : '#334155',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <span>{b.name}</span>
                    <span style={{ fontSize: '11px', opacity: 0.85, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.1)' }}>
                      {b.gender === 'M' ? 'Муж' : b.gender === 'F' ? 'Жен' : 'Смеш'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Форма нового корпуса */}
              <form onSubmit={handleAddBuilding} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h5 style={{ fontSize: '13px', marginBottom: '10px', color: '#64748b' }}>+ Добавить новый корпус</h5>
                <input
                  type="text"
                  placeholder="Название корпуса"
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
                <select
                  value={newBuildingGender}
                  onChange={(e) => setNewBuildingGender(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="MIXED">Смешанный корпус (Смеш)</option>
                  <option value="M">Мужской корпус</option>
                  <option value="F">Женский корпус</option>
                </select>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} disabled={savingBuilding}>
                  <Plus size={16} /> Создать корпус
                </button>
              </form>
            </div>

            {/* Основной редактор этажей и конструктора */}
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {selectedBuilding ? (
                <div>
                  {/* Заголовок корпуса и управление этажами */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h2 style={{ fontSize: '20px', color: '#0f172a', margin: 0 }}>{selectedBuilding.name}</h2>
                      <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#334155' }}>
                        Тип корпуса: {selectedBuilding.gender === 'M' ? 'Мужской' : selectedBuilding.gender === 'F' ? 'Женский' : 'Смешанный (Смеш)'}
                      </span>
                    </div>

                    <button onClick={handleAddFloor} className="btn btn-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={16} /> Добавить пустой этаж
                    </button>
                  </div>

                  {/* Кнопки переключения этажей */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    {floors.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleSelectFloor(f)}
                        className={`btn ${selectedFloor?.id === f.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          padding: '6px 16px',
                          fontSize: '13px',
                          backgroundColor: selectedFloor?.id === f.id ? '#0284c7' : '#f1f5f9',
                          color: selectedFloor?.id === f.id ? '#fff' : '#475569',
                          border: 'none'
                        }}
                      >
                        Этаж {f.floor_number}
                      </button>
                    ))}
                  </div>

                  {selectedFloor ? (
                    <div>
                      {/* Панель настроек и инструментов для выбранного этажа */}
                      <div style={{
                        backgroundColor: '#f8fafc',
                        padding: '14px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
                          <div>
                            <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Ширина сетки:</label>
                            <input
                              type="number"
                              min={3}
                              max={20}
                              value={selectedFloor.width || 8}
                              onChange={(e) => handleUpdateFloorWidth(Number(e.target.value))}
                              style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Тип пола этажа:</label>
                            <select
                              value={selectedFloor.gender || 'DEFAULT'}
                              onChange={(e) => handleUpdateFloorGender(e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="DEFAULT">По умолчанию от корпуса ({selectedBuilding.gender === 'M' ? 'Муж' : selectedBuilding.gender === 'F' ? 'Жен' : 'Смеш'})</option>
                              <option value="MIXED">Смешанный (Смеш)</option>
                              <option value="M">Мужской</option>
                              <option value="F">Женский</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setGenStartNumber(selectedFloor.floor_number * 100 + 1);
                            setShowGenModal(true);
                          }}
                          className="btn btn-primary"
                          style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#8b5cf6' }}
                        >
                          <Sparkles size={16} /> Сгенерировать комнаты
                        </button>
                      </div>

                      {/* Плитки-заготовки для перетаскивания и точечного применения */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                          Плитки-заготовки (выберите кисть или перетащите мышью на сетку):
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {TILE_TEMPLATES.map((tmpl) => {
                            const IconComp = tmpl.icon;
                            const isSelected = selectedTool === tmpl.type;
                            return (
                              <div
                                key={tmpl.type}
                                draggable
                                onDragStart={(e) => handleDragStart(e, tmpl.type)}
                                onClick={() => setSelectedTool(tmpl.type)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: tmpl.bg,
                                  border: `2px solid ${isSelected ? '#0284c7' : tmpl.borderColor}`,
                                  color: tmpl.textColor,
                                  cursor: 'grab',
                                  userSelect: 'none',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  boxShadow: isSelected ? '0 0 0 2px rgba(2, 132, 199, 0.3)' : 'none',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <IconComp size={18} />
                                <span>{tmpl.title}</span>
                                {isSelected && <Check size={14} style={{ marginLeft: '4px' }} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Модальное окно мастера автогенерации */}
                      {showGenModal && (
                        <div style={{
                          backgroundColor: '#f0f9ff',
                          border: '2px dashed #0284c7',
                          padding: '16px',
                          borderRadius: '8px',
                          marginBottom: '20px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Compass size={20} /> Мастер автогенерации комнат
                            </h4>
                            <button onClick={() => setShowGenModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                          </div>

                          <p style={{ fontSize: '13px', color: '#0c4a6e', marginBottom: '12px' }}>
                            Генерация расположит комнаты по порядку вокруг коридора (по часовой стрелке). Укажите начальный номер комнаты.
                          </p>

                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <label style={{ fontSize: '13px', fontWeight: 600, marginRight: '8px' }}>Начальный номер:</label>
                              <input
                                type="number"
                                value={genStartNumber}
                                onChange={(e) => setGenStartNumber(Number(e.target.value))}
                                style={{ width: '100px', padding: '6px', borderRadius: '4px', border: '1px solid #0284c7' }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <RotateCw size={18} color="#0284c7" />
                              <span style={{ fontSize: '13px' }}>Траектория: по часовой стрелке</span>
                            </div>

                            <button
                              onClick={handleRunAutoGeneration}
                              className="btn btn-primary"
                              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Play size={16} /> Запустить автозаполнение
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Сетка визуального конструктора макета этажа */}
                      <div style={{ overflowX: 'auto', padding: '10px 0' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${selectedFloor.width || 8}, 85px)`,
                          gap: '8px',
                          justifyContent: 'start',
                        }}>
                          {/* ВЕРХНИЙ РЯД (y = 0) */}
                          {Array.from({ length: selectedFloor.width || 8 }).map((_, x) => {
                            const room = rooms.find((r) => r.x_pos === x && r.y_pos === 0);
                            const cwIdx = getCellClockwiseIndex(x, 0, selectedFloor.width || 8);
                            const tmpl = TILE_TEMPLATES.find((t) => t.type === (room?.room_type || (room?.is_technical ? 'tech' : 'room')));
                            const IconComp = tmpl?.icon || Bed;

                            return (
                              <div
                                key={`top-${x}`}
                                onClick={() => handleCellClick(x, 0)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, x, 0)}
                                style={{
                                  height: '80px',
                                  border: room ? `2px solid ${tmpl?.borderColor}` : '2px dashed #cbd5e1',
                                  borderRadius: '8px',
                                  backgroundColor: room ? tmpl?.bg : '#ffffff',
                                  color: tmpl?.textColor || '#64748b',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  position: 'relative',
                                  transition: 'transform 0.1s ease',
                                }}
                              >
                                <span style={{ position: 'absolute', top: '3px', left: '4px', fontSize: '9px', opacity: 0.6 }}>
                                  #{cwIdx}
                                </span>

                                {room ? (
                                  <>
                                    <IconComp size={18} style={{ marginBottom: '2px' }} />
                                    <strong>{room.room_number}</strong>
                                    <span style={{ fontSize: '10px' }}>
                                      {room.room_type === 'room' ? `${room.capacity} мест` : tmpl?.title}
                                    </span>
                                  </>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>+ Пусто</span>
                                )}
                              </div>
                            );
                          })}

                          {/* КОРИДОР (y = 1) */}
                          <div style={{
                            gridColumn: `1 / span ${selectedFloor.width || 8}`,
                            height: '36px',
                            backgroundColor: '#e2e8f0',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#475569',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            letterSpacing: '2px',
                          }}>
                            ═══ КОРИДОР ═══
                          </div>

                          {/* НИЖНИЙ РЯД (y = 2) */}
                          {Array.from({ length: selectedFloor.width || 8 }).map((_, x) => {
                            const room = rooms.find((r) => r.x_pos === x && r.y_pos === 2);
                            const cwIdx = getCellClockwiseIndex(x, 2, selectedFloor.width || 8);
                            const tmpl = TILE_TEMPLATES.find((t) => t.type === (room?.room_type || (room?.is_technical ? 'tech' : 'room')));
                            const IconComp = tmpl?.icon || Bed;

                            return (
                              <div
                                key={`bot-${x}`}
                                onClick={() => handleCellClick(x, 2)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, x, 2)}
                                style={{
                                  height: '80px',
                                  border: room ? `2px solid ${tmpl?.borderColor}` : '2px dashed #cbd5e1',
                                  borderRadius: '8px',
                                  backgroundColor: room ? tmpl?.bg : '#ffffff',
                                  color: tmpl?.textColor || '#64748b',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  position: 'relative',
                                  transition: 'transform 0.1s ease',
                                }}
                              >
                                <span style={{ position: 'absolute', top: '3px', left: '4px', fontSize: '9px', opacity: 0.6 }}>
                                  #{cwIdx}
                                </span>

                                {room ? (
                                  <>
                                    <IconComp size={18} style={{ marginBottom: '2px' }} />
                                    <strong>{room.room_number}</strong>
                                    <span style={{ fontSize: '10px' }}>
                                      {room.room_type === 'room' ? `${room.capacity} мест` : tmpl?.title}
                                    </span>
                                  </>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>+ Пусто</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Форма детального редактирования выбранного помещения */}
                      {selectedRoom && (
                        <div style={{
                          marginTop: '24px',
                          backgroundColor: '#f8fafc',
                          padding: '16px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                              Параметры ячейки ({selectedRoom.x_pos + 1} колонка, {selectedRoom.y_pos === 0 ? 'Верхний ряд' : 'Нижний ряд'})
                            </h4>
                            <button onClick={() => setSelectedRoom(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                          </div>

                          <form onSubmit={handleSaveRoomDetails} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Номер комнаты / помещения</label>
                              <input
                                type="text"
                                value={selectedRoom.room_number}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, room_number: e.target.value })}
                                required
                              />
                            </div>

                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Название объекта</label>
                              <input
                                type="text"
                                value={selectedRoom.name || ''}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, name: e.target.value })}
                              />
                            </div>

                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Тип объекта</label>
                              <select
                                value={selectedRoom.room_type || 'room'}
                                onChange={(e) => {
                                  const rType = e.target.value;
                                  setSelectedRoom({
                                    ...selectedRoom,
                                    room_type: rType,
                                    is_technical: rType === 'tech' ? 1 : 0
                                  });
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                <option value="room">Жилая комната</option>
                                <option value="elevator">Лифт</option>
                                <option value="stairs">Лестница</option>
                                <option value="tech">Техническое помещение</option>
                              </select>
                            </div>

                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Вместимость (человек)</label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={selectedRoom.capacity}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, capacity: Number(e.target.value) })}
                              />
                            </div>

                            <div className="input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Пол комнаты</label>
                              <select
                                value={selectedRoom.gender || 'DEFAULT'}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, gender: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                <option value="DEFAULT">По умолчанию (от корпуса или этажа)</option>
                                <option value="MIXED">Смешанный (Смеш)</option>
                                <option value="M">Мужской</option>
                                <option value="F">Женский</option>
                              </select>
                            </div>

                            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                              <button type="submit" className="btn btn-primary" disabled={savingRoom} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <SquareCheck size={16} /> {savingRoom ? 'Сохранение...' : 'Сохранить изменения помещения'}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Нажмите "+ Добавить пустой этаж" для начала работы.</p>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94a3b8' }}>Выберите или создайте корпус слева.</p>
              )}
            </div>

          </div>
        )}
      </div>
    </AdminLayout>
  );
};