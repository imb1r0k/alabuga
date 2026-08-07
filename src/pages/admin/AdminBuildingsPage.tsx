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
  api,
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
  SquareCheck,
  Play,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Square,
  Zap,
  X
} from 'lucide-react';

type TileType = 'room' | 'elevator' | 'stairs' | 'tech' | 'gen-start' | 'gen-turn' | 'gen-end';
type Direction = 'right' | 'down' | 'left' | 'up';

interface TileTemplate {
  type: TileType;
  title: string;
  icon: React.ElementType;
  bg: string;
  borderColor: string;
  textColor: string;
  dir?: Direction;
}

const STANDARD_TEMPLATES: TileTemplate[] = [
  { type: 'room', title: 'Комната', icon: Bed, bg: '#d1e7dd', borderColor: '#a3cfbb', textColor: '#0f5132' },
  { type: 'elevator', title: 'Лифт', icon: ArrowUpDown, bg: '#cff4fc', borderColor: '#9eeaf9', textColor: '#055160' },
  { type: 'stairs', title: 'Лестница', icon: Footprints, bg: '#fff3cd', borderColor: '#ffe69c', textColor: '#664d03' },
  { type: 'tech', title: 'Техническая', icon: Wrench, bg: '#e2e3e5', borderColor: '#c4c8cb', textColor: '#41464b' },
];

const GEN_TEMPLATES: TileTemplate[] = [
  { type: 'gen-start', title: 'Начало генерации', icon: Play, bg: '#d1e7dd', borderColor: '#198754', textColor: '#0f5132', dir: 'right' },
  { type: 'gen-turn', title: 'Поворот генерации', icon: RotateCw, bg: '#cff4fc', borderColor: '#0dcaf0', textColor: '#055160', dir: 'right' },
  { type: 'gen-end', title: 'Конец генерации', icon: Square, bg: '#f8d7da', borderColor: '#dc3545', textColor: '#842029' },
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

  // Режим генерации
  const [genMode, setGenMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<TileType>('room');
  const [selectedDir, setSelectedDir] = useState<Direction>('right');

  // Параметры алгоритма генератора
  const [genFrom, setGenFrom] = useState(101);
  const [genTo, setGenTo] = useState(120);
  const [genSeats, setGenSeats] = useState(2);
  const [genStatusMsg, setGenStatusMsg] = useState('');

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

  // Порядковый номер по часовой стрелке
  const getClockwiseCells = (width: number) => {
    const cells: { x: number; y: number; index: number }[] = [];
    let idx = 1;

    // Верхняя линия (y = 0)
    for (let x = 0; x < width; x++) {
      cells.push({ x, y: 0, index: idx++ });
    }
    // Нижняя линия (y = 2)
    for (let x = width - 1; x >= 0; x--) {
      cells.push({ x, y: 2, index: idx++ });
    }
    return cells;
  };

  const getCellClockwiseIndex = (x: number, y: number, width: number) => {
    const cells = getClockwiseCells(width);
    const item = cells.find((c) => c.x === x && c.y === y);
    return item ? item.index : 1;
  };

  const calculateAutoRoomNumber = (x: number, y: number, width: number, floorNum: number) => {
    const idx = getCellClockwiseIndex(x, y, width);
    const suffix = idx < 10 ? `0${idx}` : `${idx}`;
    return `${floorNum}${suffix}`;
  };

  // Размещение ячейки (по клику или D&D)
  const placeTileAt = async (x: number, y: number, type: TileType, dir: Direction = 'right') => {
    if (y === 1 || !selectedFloor || !selectedBuilding) return;

    const width = selectedFloor.width || 8;
    const existing = rooms.find((r) => r.x_pos === x && r.y_pos === y);
    const autoNum = calculateAutoRoomNumber(x, y, width, selectedFloor.floor_number);

    let name = 'Комната';
    let capacity = 2;
    let isTechnical = 0;

    if (type === 'elevator') {
      name = 'Лифт'; capacity = 0;
    } else if (type === 'stairs') {
      name = 'Лестница'; capacity = 0;
    } else if (type === 'tech') {
      name = 'Техническое'; capacity = 0; isTechnical = 1;
    } else if (type === 'gen-start') {
      name = `[Старт -> ${dir}]`; capacity = 0; isTechnical = 1;
    } else if (type === 'gen-turn') {
      name = `[Поворот -> ${dir}]`; capacity = 0; isTechnical = 1;
    } else if (type === 'gen-end') {
      name = '[Конец]'; capacity = 0; isTechnical = 1;
    } else {
      name = `Комната ${autoNum}`;
    }

    const roomData = {
      id: existing?.id,
      floor_id: selectedFloor.id,
      building_id: selectedBuilding.id,
      room_number: existing?.room_number || autoNum,
      name,
      capacity,
      is_technical: isTechnical,
      room_type: type,
      gender: existing?.gender || 'DEFAULT',
      x_pos: x,
      y_pos: y,
    };

    try {
      await saveAdminRoom(roomData);
      handleSelectFloor(selectedFloor);
    } catch (err) {
      console.error('Ошибка сохранения ячейки:', err);
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (y === 1) return;
    const existing = rooms.find((r) => r.x_pos === x && r.y_pos === y);
    if (existing && !genMode) {
      setSelectedRoom({ ...existing });
    } else {
      placeTileAt(x, y, selectedTool, selectedDir);
    }
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, type: TileType) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, dir: selectedDir }));
  };

  const handleDrop = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    if (y === 1) return;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        placeTileAt(x, y, parsed.type || selectedTool, parsed.dir || selectedDir);
      } else {
        placeTileAt(x, y, selectedTool, selectedDir);
      }
    } catch (_) {
      placeTileAt(x, y, selectedTool, selectedDir);
    }
  };

  // Удаление помещения из ячейки
  const handleDeleteRoom = async (e: React.MouseEvent, roomId: number) => {
    e.stopPropagation();
    try {
      await api.post('/admin/rooms', { id: roomId, room_number: '', capacity: 0, room_type: 'empty' });
      handleSelectFloor(selectedFloor);
      setSelectedRoom(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Смена направления стрелки у генератора
  const handleSetDirectionForCell = async (e: React.MouseEvent, room: any, newDir: Direction) => {
    e.stopPropagation();
    let name = room.name;
    if (room.room_type === 'gen-start') name = `[Старт -> ${newDir}]`;
    if (room.room_type === 'gen-turn') name = `[Поворот -> ${newDir}]`;

    try {
      await saveAdminRoom({
        ...room,
        name,
      });
      handleSelectFloor(selectedFloor);
    } catch (err) {
      console.error(err);
    }
  };

  // АЛГОРИТМ ГЕНЕРАЦИИ КОМНАТ
  const handleRunGeneration = async () => {
    if (!selectedFloor || !selectedBuilding) return;
    setGenStatusMsg('Запуск генерации...');

    // Ищем стартовую плитку gen-start
    const startRoom = rooms.find((r) => r.room_type === 'gen-start');
    if (!startRoom) {
      setGenStatusMsg('Ошибка: Поместите маркер "Начало генерации" ▶ на сетку');
      return;
    }

    const width = selectedFloor.width || 8;
    let currentNum = genFrom;
    let rX = startRoom.x_pos;
    let rY = startRoom.y_pos;

    // Определяем начальное направление из имени или по умолчанию
    let currentDir: Direction = 'right';
    if (startRoom.name.includes('down')) currentDir = 'down';
    if (startRoom.name.includes('left')) currentDir = 'left';
    if (startRoom.name.includes('up')) currentDir = 'up';

    const STEP: Record<Direction, [number, number]> = {
      right: [1, 0],
      left: [-1, 0],
      down: [0, 2], // Переход между верхним и нижним рядом через коридор
      up: [0, -2],
    };

    let placedCount = 0;
    let stepsLimit = 200; // зашита от циклов

    while (currentNum <= genTo && stepsLimit > 0) {
      stepsLimit--;

      // Создаем/обновляем комнату в текущих координатах (rX, rY)
      const existing = rooms.find((r) => r.x_pos === rX && r.y_pos === rY);
      const roomNumStr = `${currentNum}`;

      await saveAdminRoom({
        id: existing?.id,
        floor_id: selectedFloor.id,
        building_id: selectedBuilding.id,
        room_number: roomNumStr,
        name: `Комната ${roomNumStr}`,
        capacity: genSeats,
        is_technical: 0,
        room_type: 'room',
        gender: 'DEFAULT',
        x_pos: rX,
        y_pos: rY,
      });

      placedCount++;
      currentNum++;

      // Считаем следующий шаг
      const [dCols, dRows] = STEP[currentDir];
      let nextX = rX + dCols;
      let nextY = rY + dRows;

      // Проверяем границы сетки
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY > 2) {
        break; // Достигли края
      }

      // Проверяем объект в следующей ячейке
      const nextTile = rooms.find((r) => r.x_pos === nextX && r.y_pos === nextY);

      if (nextTile?.room_type === 'gen-end') {
        // Заполняем последнюю комнату на месте gen-end и выходим
        await saveAdminRoom({
          id: nextTile.id,
          floor_id: selectedFloor.id,
          building_id: selectedBuilding.id,
          room_number: `${currentNum}`,
          name: `Комната ${currentNum}`,
          capacity: genSeats,
          is_technical: 0,
          room_type: 'room',
          gender: 'DEFAULT',
          x_pos: nextX,
          y_pos: nextY,
        });
        placedCount++;
        break;
      }

      if (nextTile?.room_type === 'gen-turn') {
        // Поворот траектории
        if (nextTile.name.includes('down')) currentDir = 'down';
        else if (nextTile.name.includes('left')) currentDir = 'left';
        else if (nextTile.name.includes('up')) currentDir = 'up';
        else if (nextTile.name.includes('right')) currentDir = 'right';
        else {
          // Если не указан явно, поворачиваем вниз/вверх в зависимости от текущего ряда
          currentDir = rY === 0 ? 'down' : 'up';
        }
      }

      rX = nextX;
      rY = nextY;
    }

    setGenStatusMsg(`✅ Успешно сгенерировано ${placedCount} комнат (${genFrom}–${genFrom + placedCount - 1})`);
    handleSelectFloor(selectedFloor);
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

            {/* Основной редактор этажей */}
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {selectedBuilding ? (
                <div>
                  {/* Переключатель режима конструктора / генерации */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h2 style={{ fontSize: '20px', color: '#0f172a', margin: 0 }}>{selectedBuilding.name}</h2>
                      <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#334155' }}>
                        Тип: {selectedBuilding.gender === 'M' ? 'Мужской' : selectedBuilding.gender === 'F' ? 'Женский' : 'Смешанный'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setGenMode(!genMode)}
                        className={`btn ${genMode ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: genMode ? '#6d28d9' : '#f1f5f9',
                          color: genMode ? '#fff' : '#475569',
                        }}
                      >
                        <Zap size={16} /> {genMode ? 'Режим генерации ВКЛ' : '⚡ Включить генерацию'}
                      </button>

                      <button onClick={handleAddFloor} className="btn btn-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} /> Добавить пустой этаж
                      </button>
                    </div>
                  </div>

                  {/* Кнопки этажей */}
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
                      {/* Панель настроек этажа */}
                      <div style={{
                        backgroundColor: '#f8fafc',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '16px',
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
                      </div>

                      {/* Палитра выбора плиток */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                          {genMode ? 'Маркеры автогенерации (перетащите на сетку или кликните):' : 'Заготовки стандартных помещений (Drag & Drop или клик):'}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {(genMode ? GEN_TEMPLATES : STANDARD_TEMPLATES).map((tmpl) => {
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

                      {/* Панель настройки траектории генератора */}
                      {genMode && (
                        <div style={{
                          backgroundColor: '#f3e8ff',
                          border: '2px dashed #8b5cf6',
                          padding: '16px',
                          borderRadius: '8px',
                          marginBottom: '20px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                              <Zap size={18} /> Панель автогенерации по маркерам
                            </h4>
                          </div>

                          <p style={{ fontSize: '12px', color: '#581c87', marginBottom: '12px' }}>
                            Разместите на сетке плитки <strong>▶ Начало</strong>, <strong>↪ Поворот</strong> и <strong>⏹ Конец</strong>, укажите их направление стрелками и нажмите кнопку ниже:
                          </p>

                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Начальная квартира:</label>
                              <input
                                type="number"
                                value={genFrom}
                                onChange={(e) => setGenFrom(Number(e.target.value))}
                                style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Конечная квартира:</label>
                              <input
                                type="number"
                                value={genTo}
                                onChange={(e) => setGenTo(Number(e.target.value))}
                                style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Мест в комнате:</label>
                              <input
                                type="number"
                                value={genSeats}
                                onChange={(e) => setGenSeats(Number(e.target.value))}
                                style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }}
                              />
                            </div>

                            <button
                              onClick={handleRunGeneration}
                              className="btn btn-primary"
                              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#7c3aed' }}
                            >
                              <Play size={16} /> Запустить генерацию
                            </button>
                          </div>

                          {genStatusMsg && (
                            <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: genStatusMsg.includes('Ошибка') ? '#dc2626' : '#15803d' }}>
                              {genStatusMsg}
                            </div>
                          )}
                        </div>
                      )}

                      {/* СЕТКА СКОНСТРУИРОВАННОГО ЭТАЖА */}
                      <div style={{ overflowX: 'auto', padding: '10px 0' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${selectedFloor.width || 8}, 90px)`,
                          gap: '8px',
                          justifyContent: 'start',
                        }}>
                          {/* ВЕРХНИЙ РЯД (y = 0) */}
                          {Array.from({ length: selectedFloor.width || 8 }).map((_, x) => {
                            const room = rooms.find((r) => r.x_pos === x && r.y_pos === 0);
                            const cwIdx = getCellClockwiseIndex(x, 0, selectedFloor.width || 8);
                            const tmpl = [...STANDARD_TEMPLATES, ...GEN_TEMPLATES].find((t) => t.type === room?.room_type);
                            const IconComp = tmpl?.icon || Bed;

                            return (
                              <div
                                key={`top-${x}`}
                                onClick={() => handleCellClick(x, 0)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, x, 0)}
                                style={{
                                  height: '85px',
                                  border: room ? `2px solid ${tmpl?.borderColor || '#0284c7'}` : '2px dashed #cbd5e1',
                                  borderRadius: '8px',
                                  backgroundColor: room ? (tmpl?.bg || '#e0f2fe') : '#ffffff',
                                  color: tmpl?.textColor || '#0369a1',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  position: 'relative',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span style={{ position: 'absolute', top: '3px', left: '4px', fontSize: '9px', opacity: 0.6 }}>
                                  #{cwIdx}
                                </span>

                                {room && (
                                  <button
                                    onClick={(e) => handleDeleteRoom(e, room.id)}
                                    title="Удалить помещение"
                                    style={{
                                      position: 'absolute',
                                      top: '2px',
                                      right: '3px',
                                      border: 'none',
                                      background: 'rgba(239, 68, 68, 0.8)',
                                      color: '#fff',
                                      borderRadius: '50%',
                                      width: '16px',
                                      height: '16px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: 0
                                    }}
                                  >
                                    <X size={10} />
                                  </button>
                                )}

                                {room ? (
                                  <>
                                    <IconComp size={20} style={{ marginBottom: '2px' }} />
                                    <strong>{room.room_number || room.name}</strong>

                                    {/* Переключатели стрелок для генераторов */}
                                    {(room.room_type === 'gen-start' || room.room_type === 'gen-turn') && (
                                      <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'right')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowRight size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'down')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowDown size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'left')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowLeft size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'up')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowUp size={12} /></button>
                                      </div>
                                    )}

                                    {room.room_type === 'room' && (
                                      <span style={{ fontSize: '10px', opacity: 0.8 }}>
                                        {room.capacity} мест
                                      </span>
                                    )}
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
                            const tmpl = [...STANDARD_TEMPLATES, ...GEN_TEMPLATES].find((t) => t.type === room?.room_type);
                            const IconComp = tmpl?.icon || Bed;

                            return (
                              <div
                                key={`bot-${x}`}
                                onClick={() => handleCellClick(x, 2)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, x, 2)}
                                style={{
                                  height: '85px',
                                  border: room ? `2px solid ${tmpl?.borderColor || '#0284c7'}` : '2px dashed #cbd5e1',
                                  borderRadius: '8px',
                                  backgroundColor: room ? (tmpl?.bg || '#e0f2fe') : '#ffffff',
                                  color: tmpl?.textColor || '#0369a1',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  position: 'relative',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span style={{ position: 'absolute', top: '3px', left: '4px', fontSize: '9px', opacity: 0.6 }}>
                                  #{cwIdx}
                                </span>

                                {room && (
                                  <button
                                    onClick={(e) => handleDeleteRoom(e, room.id)}
                                    title="Удалить помещение"
                                    style={{
                                      position: 'absolute',
                                      top: '2px',
                                      right: '3px',
                                      border: 'none',
                                      background: 'rgba(239, 68, 68, 0.8)',
                                      color: '#fff',
                                      borderRadius: '50%',
                                      width: '16px',
                                      height: '16px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: 0
                                    }}
                                  >
                                    <X size={10} />
                                  </button>
                                )}

                                {room ? (
                                  <>
                                    <IconComp size={20} style={{ marginBottom: '2px' }} />
                                    <strong>{room.room_number || room.name}</strong>

                                    {/* Переключатели стрелок для генераторов */}
                                    {(room.room_type === 'gen-start' || room.room_type === 'gen-turn') && (
                                      <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'right')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowRight size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'down')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowDown size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'left')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowLeft size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'up')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowUp size={12} /></button>
                                      </div>
                                    )}

                                    {room.room_type === 'room' && (
                                      <span style={{ fontSize: '10px', opacity: 0.8 }}>
                                        {room.capacity} мест
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>+ Пусто</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Детальное редактирование выбранной ячейки */}
                      {selectedRoom && (
                        <div style={{
                          marginTop: '20px',
                          backgroundColor: '#f8fafc',
                          padding: '16px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
                              Редактирование ячейки [{selectedRoom.x_pos + 1}, {selectedRoom.y_pos === 0 ? 'Верх' : 'Низ'}]
                            </h4>
                            <button onClick={() => setSelectedRoom(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                          </div>

                          <form onSubmit={handleSaveRoomDetails} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Номер комнаты</label>
                              <input
                                type="text"
                                value={selectedRoom.room_number}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, room_number: e.target.value })}
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
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Вместимость мест</label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={selectedRoom.capacity}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, capacity: Number(e.target.value) })}
                              />
                            </div>

                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Пол ячейки</label>
                              <select
                                value={selectedRoom.gender || 'DEFAULT'}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, gender: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                <option value="DEFAULT">По умолчанию</option>
                                <option value="MIXED">Смешанный (Смеш)</option>
                                <option value="M">Мужской</option>
                                <option value="F">Женский</option>
                              </select>
                            </div>

                            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                              <button type="submit" className="btn btn-primary" disabled={savingRoom} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <SquareCheck size={16} /> {savingRoom ? 'Сохранение...' : 'Сохранить изменения'}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Нажмите "+ Добавить пустой этаж" для создания первого этажа.</p>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94a3b8' }}>Выберите или создайте корпус в меню слева.</p>
              )}
            </div>

          </div>
        )}
      </div>
    </AdminLayout>
  );
};