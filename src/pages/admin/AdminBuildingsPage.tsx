import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import {
  getAdminBuildings,
  saveAdminBuilding,
  deleteAdminBuilding,
  getAdminFloors,
  saveAdminFloor,
  deleteAdminFloor,
  getAdminRooms,
  saveAdminRoom,
  deleteAdminRoom,
  getAdminBookings,
  getRoomBookings,
  updateAdminBooking,
} from '../../services/api';
import { 
  Bed, 
  ArrowUpDown, 
  Footprints, 
  Wrench, 
  Plus, 
  SquareCheck,
  Play,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Square,
  Zap,
  X,
  Check,
  Edit3,
  Eye,
  Trash2,
  Users,
  AlertTriangle,
  Save,
  RotateCcw
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
}

const STANDARD_TEMPLATES: TileTemplate[] = [
  { type: 'room', title: 'Комната', icon: Bed, bg: '#d1e7dd', borderColor: '#a3cfbb', textColor: '#0f5132' },
  { type: 'elevator', title: 'Лифт', icon: ArrowUpDown, bg: '#cff4fc', borderColor: '#9eeaf9', textColor: '#055160' },
  { type: 'stairs', title: 'Лестница', icon: Footprints, bg: '#fff3cd', borderColor: '#ffe69c', textColor: '#664d03' },
  { type: 'tech', title: 'Техническая', icon: Wrench, bg: '#e2e3e5', borderColor: '#c4c8cb', textColor: '#41464b' },
];

const GEN_TEMPLATES: TileTemplate[] = [
  { type: 'gen-start', title: 'Начало генерации', icon: Play, bg: '#d1e7dd', borderColor: '#198754', textColor: '#0f5132' },
  { type: 'gen-turn', title: 'Поворот генерации', icon: RotateCw, bg: '#cff4fc', borderColor: '#0dcaf0', textColor: '#055160' },
  { type: 'gen-end', title: 'Конец генерации', icon: Square, bg: '#f8d7da', borderColor: '#dc3545', textColor: '#842029' },
];

// Вспомогательный круглый значок пола
const GenderBadge: React.FC<{ gender?: string; size?: number }> = ({ gender = 'MIXED', size = 20 }) => {
  let label = 'С';
  let bg = '#8b5cf6';

  if (gender === 'M') {
    label = 'М';
    bg = '#0284c7';
  } else if (gender === 'F') {
    label = 'Ж';
    bg = '#e11d48';
  }

  return (
    <span
      title={`Пол: ${gender === 'M' ? 'Мужской' : gender === 'F' ? 'Женский' : 'Смешанный'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: bg,
        color: '#ffffff',
        fontSize: `${Math.round(size * 0.55)}px`,
        fontWeight: 'bold',
        lineHeight: 1,
        flexShrink: 0
      }}
    >
      {label}
    </span>
  );
};

export const AdminBuildingsPage: React.FC = () => {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  
  // Серверное состояние комнат и локальное (черновик) состояние
  const [rooms, setRooms] = useState<any[]>([]);
  const [localRooms, setLocalRooms] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [roomBookings, setRoomBookings] = useState<any[]>([]);

  // Режим редактирования макета (по умолчанию FALSE)
  const [isEditLayout, setIsEditLayout] = useState(false);

  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  
  // Добавление корпуса
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingGender, setNewBuildingGender] = useState<'M' | 'F' | 'MIXED'>('MIXED');

  // Окно создания этажа с диалогом пропуска этажей
  const [showAddFloorModal, setShowAddFloorModal] = useState(false);
  const [newFloorNumberInput, setNewFloorNumberInput] = useState<number>(1);
  const [newFloorStartRoomNum, setNewFloorStartRoomNum] = useState<number | ''>('');

  // Подтверждение удаления
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'building' | 'floor' | 'room'; id: number; name: string } | null>(null);

  // Режим генерации
  const [genMode, setGenMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<TileType>('room');
  const [selectedDir, setSelectedDir] = useState<Direction>('right');
  const [draggedTile, setDraggedTile] = useState<{ type: TileType; dir: Direction } | null>(null);

  // Параметры генератора
  const [genFrom, setGenFrom] = useState(1);
  const [genTo, setGenTo] = useState(20);
  const [genSeats, setGenSeats] = useState(2);
  const [genStatusMsg, setGenStatusMsg] = useState('');

  useEffect(() => {
    loadBuildings();
    loadAllBookings();
  }, []);

  const loadAllBookings = async () => {
    try {
      const bData = await getAdminBookings();
      setAllBookings(bData);
    } catch (err) {
      console.error('Ошибка загрузки бронирований:', err);
    }
  };

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
    setIsEditLayout(false);
    setHasUnsavedChanges(false);
    try {
      const fData = await getAdminFloors(b.id);
      setFloors(fData);
      if (fData.length > 0) {
        handleSelectFloor(fData[0], fData);
      } else {
        setSelectedFloor(null);
        setRooms([]);
        setLocalRooms([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectFloor = async (f: any, currentFloorsList = floors) => {
    setSelectedFloor(f);
    setSelectedRoom(null);
    setHasUnsavedChanges(false);
    try {
      const rData = await getAdminRooms(f.id);
      setRooms(rData);
      setLocalRooms(rData);

      // Рассчитываем авто-диапазон генерации для этого этажа
      const startNum = calculateFloorStartRoomNumber(f, currentFloorsList);
      setGenFrom(startNum);
      setGenTo(startNum + (Number(f.width) || 8) * 2 - 1);
    } catch (err) {
      console.error(err);
    }
  };

  // Вычисление начального номера комнат на этаже
  const calculateFloorStartRoomNumber = (targetFloor: any, floorsList = floors) => {
    if (targetFloor.start_room_number && Number(targetFloor.start_room_number) > 0) {
      return Number(targetFloor.start_room_number);
    }

    // Считаем сумму ячеек на всех предыдущих этажах (по floor_number)
    const lowerFloors = floorsList.filter((f) => Number(f.floor_number) < Number(targetFloor.floor_number));
    let start = 1;
    for (const lf of lowerFloors) {
      const cellsCount = (Number(lf.width) || 8) * 2;
      start += cellsCount;
    }
    return start;
  };

  // Порядковый номер ячейки по часовой стрелке (1..2W)
  const getClockwiseCells = (width: number) => {
    const cells: { x: number; y: number; index: number }[] = [];
    let idx = 1;
    for (let x = 0; x < width; x++) {
      cells.push({ x, y: 0, index: idx++ });
    }
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

  // Получить глобальный сквозной номер для конкретной ячейки
  const getCalculatedRoomNumber = (x: number, y: number) => {
    if (!selectedFloor) return 1;
    const width = Number(selectedFloor.width) || 8;
    const cellIdx = getCellClockwiseIndex(x, y, width);
    const floorStart = calculateFloorStartRoomNumber(selectedFloor);
    return floorStart + cellIdx - 1;
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

  // Открытие диалога добавления этажа
  const openAddFloorModal = () => {
    const maxFloorNum = floors.reduce((max, f) => Math.max(max, Number(f.floor_number)), 0);
    const nextNum = maxFloorNum + 1;
    setNewFloorNumberInput(nextNum);

    // Предполагаемый начальный номер комнат
    const nextStartNum = floors.reduce((sum, f) => sum + (Number(f.width) || 8) * 2, 1);
    setNewFloorStartRoomNum(nextStartNum);
    setShowAddFloorModal(true);
  };

  const handleCreateFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding) return;
    try {
      await saveAdminFloor({
        building_id: selectedBuilding.id,
        floor_number: newFloorNumberInput,
        width: 8,
        gender: 'DEFAULT',
        start_room_number: newFloorStartRoomNum ? Number(newFloorStartRoomNum) : null
      });
      setShowAddFloorModal(false);
      handleSelectBuilding(selectedBuilding);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFloorWidth = (newWidth: number) => {
    if (!selectedFloor || newWidth < 3 || newWidth > 20) return;
    setSelectedFloor({ ...selectedFloor, width: newWidth });
    setHasUnsavedChanges(true);
  };

  const handleUpdateFloorGender = (gender: string) => {
    if (!selectedFloor) return;
    setSelectedFloor({ ...selectedFloor, gender });
    setHasUnsavedChanges(true);
  };

  const handleUpdateFloorStartRoomNum = (val: number | null) => {
    if (!selectedFloor) return;
    setSelectedFloor({ ...selectedFloor, start_room_number: val });
    setHasUnsavedChanges(true);
  };

  // Удаление с подтверждением
  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, id } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    try {
      if (type === 'building') {
        await deleteAdminBuilding(id);
        loadBuildings();
      } else if (type === 'floor') {
        await deleteAdminFloor(id);
        handleSelectBuilding(selectedBuilding);
      } else if (type === 'room') {
        setLocalRooms((prev) => prev.filter((r) => r.id !== id));
        setHasUnsavedChanges(true);
        setSelectedRoom(null);
      }
    } catch (err) {
      console.error('Ошибка при удалении:', err);
    }
  };

  const getEffectiveGender = (targetGender?: string, parentGender?: string) => {
    if (targetGender && targetGender !== 'DEFAULT') return targetGender;
    if (parentGender && parentGender !== 'DEFAULT') return parentGender;
    return selectedBuilding?.gender || 'MIXED';
  };

  const getRoomOccupancy = (roomId: number) => {
    const booked = allBookings.filter((b) => Number(b.room_id) === Number(roomId) && b.status !== 'rejected').length;
    return booked;
  };

  const getFloorOccupancy = (floorId: number) => {
    const floorRooms = localRooms.filter((r) => Number(r.floor_id) === Number(floorId) && r.room_type === 'room');
    const totalCapacity = floorRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);
    const bookedSeats = floorRooms.reduce((sum, r) => sum + (r.id ? getRoomOccupancy(r.id) : 0), 0);
    return { booked: bookedSeats, total: totalCapacity };
  };

  const getBuildingOccupancy = () => {
    const buildingBookings = allBookings.filter((b) => Number(b.building_id) === Number(selectedBuilding?.id) && b.status !== 'rejected');
    return buildingBookings.length;
  };

  // ЛОКАЛЬНОЕ размещение ячейки в памяти (без запроса на сервер)
  const placeTileLocally = (x: number, y: number, type: TileType, dir: Direction = 'right') => {
    if (!isEditLayout || y === 1 || !selectedFloor || !selectedBuilding) return;

    const existing = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === y);
    const autoNum = `${getCalculatedRoomNumber(x, y)}`;

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
      floor_id: Number(selectedFloor.id),
      building_id: Number(selectedBuilding.id),
      room_number: existing?.room_number || autoNum,
      name,
      capacity,
      is_technical: isTechnical,
      room_type: type,
      gender: existing?.gender || 'DEFAULT',
      x_pos: x,
      y_pos: y,
    };

    setLocalRooms((prevRooms) => {
      const filtered = prevRooms.filter((r) => !(Number(r.x_pos) === x && Number(r.y_pos) === y));
      return [...filtered, roomData];
    });
    setHasUnsavedChanges(true);
  };

  const handleCellClick = async (x: number, y: number) => {
    if (y === 1) return;
    const existing = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === y);

    if (existing) {
      setSelectedRoom({ ...existing });
      if (existing.id) {
        try {
          const bList = await getRoomBookings(existing.id);
          setRoomBookings(bList);
        } catch (err) {
          console.error(err);
        }
      } else {
        setRoomBookings([]);
      }
    } else if (isEditLayout) {
      placeTileLocally(x, y, selectedTool, selectedDir);
    }
  };

  const handleDragStart = (e: React.DragEvent, type: TileType) => {
    if (!isEditLayout) return;
    const item = { type, dir: selectedDir };
    setDraggedTile(item);
    try {
      e.dataTransfer.setData('text/plain', type);
      e.dataTransfer.effectAllowed = 'copy';
    } catch (_) {}
  };

  const handleDrop = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditLayout || y === 1 || !selectedFloor) return;

    let typeToPlace = draggedTile?.type || selectedTool;
    let dirToPlace = draggedTile?.dir || selectedDir;

    try {
      const textData = e.dataTransfer.getData('text/plain') as TileType;
      if (textData && ['room', 'elevator', 'stairs', 'tech', 'gen-start', 'gen-turn', 'gen-end'].includes(textData)) {
        typeToPlace = textData;
      }
    } catch (_) {}

    placeTileLocally(x, y, typeToPlace, dirToPlace);
    setDraggedTile(null);
  };

  // Поворот локально
  const handleSetDirectionForCell = (e: React.MouseEvent, room: any, newDir: Direction) => {
    e.stopPropagation();
    let name = room.name;
    if (room.room_type === 'gen-start') name = `[Старт -> ${newDir}]`;
    if (room.room_type === 'gen-turn') name = `[Поворот -> ${newDir}]`;

    setLocalRooms((prev) =>
      prev.map((r) => (Number(r.x_pos) === Number(room.x_pos) && Number(r.y_pos) === Number(room.y_pos) ? { ...r, name } : r))
    );
    setHasUnsavedChanges(true);
  };

  // ЛОКАЛЬНЫЙ АЛГОРИТМ ГЕНЕРАЦИИ В ПАМЯТИ
  const handleRunGeneration = () => {
    if (!selectedFloor || !selectedBuilding) return;
    setGenStatusMsg('Генерация макета...');

    const startRoom = localRooms.find((r) => r.room_type === 'gen-start');
    if (!startRoom) {
      setGenStatusMsg('Ошибка: Поместите маркер "Начало генерации" ▶ на сетку');
      return;
    }

    const width = Number(selectedFloor.width) || 8;
    let currentNum = genFrom;
    let rX = Number(startRoom.x_pos);
    let rY = Number(startRoom.y_pos);

    let currentDir: Direction = 'right';
    if (startRoom.name.includes('down')) currentDir = 'down';
    if (startRoom.name.includes('left')) currentDir = 'left';
    if (startRoom.name.includes('up')) currentDir = 'up';

    const STEP: Record<Direction, [number, number]> = {
      right: [1, 0],
      left: [-1, 0],
      down: [0, 2],
      up: [0, -2],
    };

    let placedCount = 0;
    let stepsLimit = 200;
    const newRoomsList = [...localRooms];

    while (currentNum <= genTo && stepsLimit > 0) {
      stepsLimit--;

      const roomNumStr = `${currentNum}`;
      const existingIdx = newRoomsList.findIndex((r) => Number(r.x_pos) === rX && Number(r.y_pos) === rY);

      const generatedRoom = {
        id: existingIdx >= 0 ? newRoomsList[existingIdx].id : undefined,
        floor_id: Number(selectedFloor.id),
        building_id: Number(selectedBuilding.id),
        room_number: roomNumStr,
        name: `Комната ${roomNumStr}`,
        capacity: genSeats,
        is_technical: 0,
        room_type: 'room',
        gender: 'DEFAULT',
        x_pos: rX,
        y_pos: rY,
      };

      if (existingIdx >= 0) {
        newRoomsList[existingIdx] = generatedRoom;
      } else {
        newRoomsList.push(generatedRoom);
      }

      placedCount++;
      currentNum++;

      const [dCols, dRows] = STEP[currentDir];
      let nextX = rX + dCols;
      let nextY = rY + dRows;

      if (nextX < 0 || nextX >= width || nextY < 0 || nextY > 2) break;

      const nextTile = newRoomsList.find((r) => Number(r.x_pos) === nextX && Number(r.y_pos) === nextY);

      if (nextTile?.room_type === 'gen-end') {
        const endIdx = newRoomsList.findIndex((r) => Number(r.x_pos) === nextX && Number(r.y_pos) === nextY);
        newRoomsList[endIdx] = {
          ...nextTile,
          room_number: `${currentNum}`,
          name: `Комната ${currentNum}`,
          capacity: genSeats,
          is_technical: 0,
          room_type: 'room',
        };
        placedCount++;
        break;
      }

      if (nextTile?.room_type === 'gen-turn') {
        if (nextTile.name.includes('down')) currentDir = 'down';
        else if (nextTile.name.includes('left')) currentDir = 'left';
        else if (nextTile.name.includes('up')) currentDir = 'up';
        else if (nextTile.name.includes('right')) currentDir = 'right';
        else currentDir = rY === 0 ? 'down' : 'up';
      }

      rX = nextX;
      rY = nextY;
    }

    setLocalRooms(newRoomsList);
    setHasUnsavedChanges(true);
    setGenStatusMsg(`✅ Сгенерировано ${placedCount} комнат (${genFrom}–${genFrom + placedCount - 1}). Нажмите «Сохранить макет»`);
  };

  // СОХРАНЕНИЕ ВСЕГО МАКЕТА ЭТАЖА НА СЕРВЕР
  const handleSaveFullLayout = async () => {
    if (!selectedFloor) return;
    setSavingLayout(true);
    try {
      // 1. Сохраняем свойства этажа (ширину, пол, start_room_number)
      await saveAdminFloor(selectedFloor);

      // 2. Определяем удаленные комнаты и сохраняем актуальные
      const currentRemote = rooms;
      for (const remoteR of currentRemote) {
        const existsInLocal = localRooms.some((l) => Number(l.x_pos) === Number(remoteR.x_pos) && Number(l.y_pos) === Number(remoteR.y_pos));
        if (!existsInLocal) {
          await deleteAdminRoom(remoteR.id);
        }
      }

      for (const room of localRooms) {
        await saveAdminRoom(room);
      }

      // Перезагружаем свежий список комнат
      const updatedRooms = await getAdminRooms(selectedFloor.id);
      setRooms(updatedRooms);
      setLocalRooms(updatedRooms);
      setHasUnsavedChanges(false);
      alert('Макет этажа успешно сохранен в базе данных!');
    } catch (err: any) {
      alert('Ошибка при сохранении макета: ' + err.message);
    } finally {
      setSavingLayout(false);
    }
  };

  // Сброс несохраненных изменений
  const handleResetLayout = () => {
    setLocalRooms([...rooms]);
    setHasUnsavedChanges(false);
  };

  const handleUpdateBookingStatus = async (booking: any, newStatus: string) => {
    try {
      await updateAdminBooking({ ...booking, status: newStatus });
      if (selectedRoom?.id) {
        const bList = await getRoomBookings(selectedRoom.id);
        setRoomBookings(bList);
      }
      loadAllBookings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRoomDetailsLocally = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setLocalRooms((prev) =>
      prev.map((r) =>
        Number(r.x_pos) === Number(selectedRoom.x_pos) && Number(r.y_pos) === Number(selectedRoom.y_pos) ? { ...selectedRoom } : r
      )
    );
    setHasUnsavedChanges(true);
    setSelectedRoom(null);
  };

  const floorStats = selectedFloor ? getFloorOccupancy(selectedFloor.id) : { booked: 0, total: 0 };

  return (
    <AdminLayout>
      <div style={{ padding: '0 10px' }}>
        {buildingsLoading ? (
          <Skeleton width="100%" height={250} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '20px' }}>
            
            {/* Сайдбар выбора и создания корпуса */}
            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h4 style={{ fontSize: '16px', marginBottom: '14px', color: '#1e293b' }}>Список корпусов</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {buildings.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: selectedBuilding?.id === b.id ? '#0284c7' : '#f8fafc',
                      color: selectedBuilding?.id === b.id ? '#fff' : '#334155',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                    }}
                  >
                    <button
                      onClick={() => handleSelectBuilding(b)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        flex: 1,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: selectedBuilding?.id === b.id ? 600 : 400
                      }}
                    >
                      <GenderBadge gender={b.gender} size={22} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmTarget({ type: 'building', id: b.id, name: b.name });
                      }}
                      title="Удалить корпус"
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: selectedBuilding?.id === b.id ? '#fca5a5' : '#ef4444',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
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
                  <option value="MIXED">Смешанный корпус (С)</option>
                  <option value="M">Мужской корпус (М)</option>
                  <option value="F">Женский корпус (Ж)</option>
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
                  {/* Шапка корпуса и кнопки переключения Режима просмотра / редактирования */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <GenderBadge gender={selectedBuilding.gender} size={28} />
                      <h2 style={{ fontSize: '20px', color: '#0f172a', margin: 0 }}>{selectedBuilding.name}</h2>
                      <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 500 }}>
                        Забронировано в корпусе: <strong>{getBuildingOccupancy()} мест</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {/* Кнопка сохранения изменений макета */}
                      {hasUnsavedChanges && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={handleSaveFullLayout}
                            disabled={savingLayout}
                            className="btn btn-primary"
                            style={{
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#16a34a',
                              fontWeight: 'bold',
                              boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.3)'
                            }}
                          >
                            <Save size={16} /> {savingLayout ? 'Сохранение...' : '💾 Сохранить макет'}
                          </button>

                          <button
                            onClick={handleResetLayout}
                            disabled={savingLayout}
                            className="btn btn-secondary"
                            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Сбросить изменения к сохраненным"
                          >
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      )}

                      {/* Кнопка включения режима редактирования */}
                      <button
                        onClick={() => {
                          setIsEditLayout(!isEditLayout);
                          if (isEditLayout) setGenMode(false);
                        }}
                        className={`btn ${isEditLayout ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: isEditLayout ? '#0284c7' : '#f1f5f9',
                          color: isEditLayout ? '#fff' : '#334155',
                          fontWeight: 600
                        }}
                      >
                        {isEditLayout ? <Eye size={16} /> : <Edit3 size={16} />}
                        {isEditLayout ? 'Режим просмотра' : '✏️ Редактировать макет'}
                      </button>

                      {isEditLayout && (
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
                          <Zap size={16} /> {genMode ? 'Генерация ВКЛ' : '⚡ Автогенерация'}
                        </button>
                      )}

                      <button onClick={openAddFloorModal} className="btn btn-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} /> Добавить этаж
                      </button>
                    </div>
                  </div>

                  {/* Кнопки этажей с отображением пола и удаления */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    {floors.map((f) => {
                      const effectiveFloorGender = getEffectiveGender(f.gender, selectedBuilding.gender);
                      return (
                        <div
                          key={f.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: selectedFloor?.id === f.id ? '#0284c7' : '#f1f5f9',
                            color: selectedFloor?.id === f.id ? '#fff' : '#475569',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            gap: '6px'
                          }}
                        >
                          <GenderBadge gender={effectiveFloorGender} size={18} />
                          <button
                            onClick={() => handleSelectFloor(f)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              fontWeight: selectedFloor?.id === f.id ? 600 : 400,
                              fontSize: '13px',
                              padding: '4px 2px'
                            }}
                          >
                            Этаж {f.floor_number}
                          </button>
                          
                          <button
                            onClick={() => setDeleteConfirmTarget({ type: 'floor', id: f.id, name: `Этаж ${f.floor_number}` })}
                            title="Удалить этаж"
                            style={{
                              border: 'none',
                              background: 'none',
                              color: selectedFloor?.id === f.id ? '#fca5a5' : '#ef4444',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {selectedFloor ? (
                    <div>
                      {/* Статистика и свойства текущего этажа */}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <GenderBadge gender={getEffectiveGender(selectedFloor.gender, selectedBuilding.gender)} size={22} />
                            <strong>Этаж {selectedFloor.floor_number}</strong>
                          </div>

                          <div>
                            Занято мест: <strong>{floorStats.booked} / {floorStats.total} мест</strong>
                          </div>

                          {isEditLayout && (
                            <>
                              <div>
                                <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Длина сетки:</label>
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
                                <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Начальный № комнат:</label>
                                <input
                                  type="number"
                                  placeholder="Авто"
                                  value={selectedFloor.start_room_number || ''}
                                  onChange={(e) => handleUpdateFloorStartRoomNum(e.target.value ? Number(e.target.value) : null)}
                                  style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />
                              </div>

                              <div>
                                <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Пол этажа:</label>
                                <select
                                  value={selectedFloor.gender || 'DEFAULT'}
                                  onChange={(e) => handleUpdateFloorGender(e.target.value)}
                                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                >
                                  <option value="DEFAULT">От корпуса ({selectedBuilding.gender === 'M' ? 'Муж' : selectedBuilding.gender === 'F' ? 'Жен' : 'Смеш'})</option>
                                  <option value="MIXED">Смешанный (С)</option>
                                  <option value="M">Мужской (М)</option>
                                  <option value="F">Женский (Ж)</option>
                                </select>
                              </div>
                            </>
                          )}
                        </div>

                        {!isEditLayout && (
                          <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                            👁 Режим просмотра. Нажмите «✏️ Редактировать макет» для расстановки.
                          </span>
                        )}
                      </div>

                      {/* Палитра плиток в режиме редактирования */}
                      {isEditLayout && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                            {genMode ? 'Маркеры автогенерации (перетащите на сетку или кликните):' : 'Заготовки помещений (Drag & Drop или клик):'}
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
                      )}

                      {/* Панель настройки генератора */}
                      {isEditLayout && genMode && (
                        <div style={{ backgroundColor: '#f3e8ff', border: '2px dashed #8b5cf6', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                            <Zap size={18} /> Панель автогенерации по маркерам
                          </h4>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Начальная квартира:</label>
                              <input type="number" value={genFrom} onChange={(e) => setGenFrom(Number(e.target.value))} style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Конечная квартира:</label>
                              <input type="number" value={genTo} onChange={(e) => setGenTo(Number(e.target.value))} style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Мест в комнате:</label>
                              <input type="number" value={genSeats} onChange={(e) => setGenSeats(Number(e.target.value))} style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} />
                            </div>
                            <button onClick={handleRunGeneration} className="btn btn-primary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#7c3aed' }}>
                              <Play size={16} /> Запустить генерацию
                            </button>
                          </div>
                          {genStatusMsg && <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: genStatusMsg.includes('Ошибка') ? '#dc2626' : '#15803d' }}>{genStatusMsg}</div>}
                        </div>
                      )}

                      {/* СЕТКА ЭТАЖА */}
                      <div style={{ overflowX: 'auto', padding: '10px 0' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${Number(selectedFloor.width) || 8}, 95px)`,
                          gap: '8px',
                          justifyContent: 'start',
                        }}>
                          {/* ВЕРХНИЙ РЯД (y = 0) */}
                          {Array.from({ length: Number(selectedFloor.width) || 8 }).map((_, x) => {
                            const room = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === 0);
                            const calcRoomNum = getCalculatedRoomNumber(x, 0);
                            const tmpl = [...STANDARD_TEMPLATES, ...GEN_TEMPLATES].find((t) => t.type === room?.room_type);
                            const IconComp = tmpl?.icon || Bed;
                            const effectiveRoomGender = getEffectiveGender(room?.gender, selectedFloor.gender);
                            const bookedCount = room && room.room_type === 'room' && room.id ? getRoomOccupancy(room.id) : 0;

                            return (
                              <div
                                key={`top-${x}`}
                                onClick={() => handleCellClick(x, 0)}
                                onDragOver={(e) => isEditLayout && e.preventDefault()}
                                onDrop={(e) => isEditLayout && handleDrop(e, x, 0)}
                                style={{
                                  height: '95px',
                                  border: room ? `2px solid ${tmpl?.borderColor || '#0284c7'}` : '2px dashed #cbd5e1',
                                  borderRadius: '8px',
                                  backgroundColor: room ? (tmpl?.bg || '#e0f2fe') : '#ffffff',
                                  color: tmpl?.textColor || '#0369a1',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  position: 'relative',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {room && (
                                  <div style={{ position: 'absolute', top: '3px', right: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <GenderBadge gender={effectiveRoomGender} size={15} />
                                    {isEditLayout && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLocalRooms((prev) => prev.filter((r) => !(Number(r.x_pos) === x && Number(r.y_pos) === 0)));
                                          setHasUnsavedChanges(true);
                                        }}
                                        title="Удалить помещение"
                                        style={{ border: 'none', background: 'rgba(239, 68, 68, 0.85)', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                                      >
                                        <X size={9} />
                                      </button>
                                    )}
                                  </div>
                                )}

                                {room ? (
                                  <>
                                    <IconComp size={18} style={{ marginBottom: '2px', marginTop: '6px' }} />
                                    <strong>{room.room_number || room.name}</strong>

                                    {room.room_type === 'room' && (
                                      <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: 600, color: bookedCount >= room.capacity ? '#dc2626' : '#16a34a' }}>
                                        {bookedCount} / {room.capacity} мест
                                      </span>
                                    )}

                                    {isEditLayout && (room.room_type === 'gen-start' || room.room_type === 'gen-turn') && (
                                      <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'right')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowRight size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'down')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowDown size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'left')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowLeft size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'up')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowUp size={12} /></button>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '10px', display: 'block', fontWeight: 'bold', color: '#cbd5e1' }}>№ {calcRoomNum}</span>
                                    {isEditLayout ? '+ Пусто' : 'Свободно'}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* КОРИДОР (y = 1) */}
                          <div style={{
                            gridColumn: `1 / span ${Number(selectedFloor.width) || 8}`,
                            height: '32px',
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
                            ═══ КОРИДОР ═══
                          </div>

                          {/* НИЖНИЙ РЯД (y = 2) */}
                          {Array.from({ length: Number(selectedFloor.width) || 8 }).map((_, x) => {
                            const room = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === 2);
                            const calcRoomNum = getCalculatedRoomNumber(x, 2);
                            const tmpl = [...STANDARD_TEMPLATES, ...GEN_TEMPLATES].find((t) => t.type === room?.room_type);
                            const IconComp = tmpl?.icon || Bed;
                            const effectiveRoomGender = getEffectiveGender(room?.gender, selectedFloor.gender);
                            const bookedCount = room && room.room_type === 'room' && room.id ? getRoomOccupancy(room.id) : 0;

                            return (
                              <div
                                key={`bot-${x}`}
                                onClick={() => handleCellClick(x, 2)}
                                onDragOver={(e) => isEditLayout && e.preventDefault()}
                                onDrop={(e) => isEditLayout && handleDrop(e, x, 2)}
                                style={{
                                  height: '95px',
                                  border: room ? `2px solid ${tmpl?.borderColor || '#0284c7'}` : '2px dashed #cbd5e1',
                                  borderRadius: '8px',
                                  backgroundColor: room ? (tmpl?.bg || '#e0f2fe') : '#ffffff',
                                  color: tmpl?.textColor || '#0369a1',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  position: 'relative',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {room && (
                                  <div style={{ position: 'absolute', top: '3px', right: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <GenderBadge gender={effectiveRoomGender} size={15} />
                                    {isEditLayout && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLocalRooms((prev) => prev.filter((r) => !(Number(r.x_pos) === x && Number(r.y_pos) === 2)));
                                          setHasUnsavedChanges(true);
                                        }}
                                        title="Удалить помещение"
                                        style={{ border: 'none', background: 'rgba(239, 68, 68, 0.85)', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                                      >
                                        <X size={9} />
                                      </button>
                                    )}
                                  </div>
                                )}

                                {room ? (
                                  <>
                                    <IconComp size={18} style={{ marginBottom: '2px', marginTop: '6px' }} />
                                    <strong>{room.room_number || room.name}</strong>

                                    {room.room_type === 'room' && (
                                      <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: 600, color: bookedCount >= room.capacity ? '#dc2626' : '#16a34a' }}>
                                        {bookedCount} / {room.capacity} мест
                                      </span>
                                    )}

                                    {isEditLayout && (room.room_type === 'gen-start' || room.room_type === 'gen-turn') && (
                                      <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'right')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowRight size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'down')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowDown size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'left')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowLeft size={12} /></button>
                                        <button onClick={(e) => handleSetDirectionForCell(e, room, 'up')} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><ArrowUp size={12} /></button>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '10px', display: 'block', fontWeight: 'bold', color: '#cbd5e1' }}>№ {calcRoomNum}</span>
                                    {isEditLayout ? '+ Пусто' : 'Свободно'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* МОДАЛЬНОЕ ОКНО ДЕТАЛЕЙ КОМНАТЫ И БРОНИРОВАНИЙ */}
                      {selectedRoom && (
                        <div style={{
                          marginTop: '20px',
                          backgroundColor: '#f8fafc',
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <GenderBadge gender={getEffectiveGender(selectedRoom.gender, selectedFloor.gender)} size={24} />
                              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                                Информация о комнате {selectedRoom.room_number || selectedRoom.name}
                              </h3>
                            </div>
                            <button onClick={() => setSelectedRoom(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                          </div>

                          {/* Секция списка бронирований этой комнаты */}
                          <div style={{ marginBottom: '20px', backgroundColor: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Users size={16} /> Бронирования в этой комнате ({roomBookings.length} / {selectedRoom.capacity} мест)
                            </h4>

                            {roomBookings.length > 0 ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#64748b' }}>
                                    <th style={{ padding: '6px', textAlign: 'left' }}>#</th>
                                    <th style={{ padding: '6px', textAlign: 'left' }}>ФИО</th>
                                    <th style={{ padding: '6px', textAlign: 'left' }}>Телефон</th>
                                    <th style={{ padding: '6px', textAlign: 'left' }}>Email</th>
                                    <th style={{ padding: '6px', textAlign: 'left' }}>Статус</th>
                                    <th style={{ padding: '6px', textAlign: 'left' }}>Действие</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {roomBookings.map((b) => (
                                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '6px' }}>#{b.id}</td>
                                      <td style={{ padding: '6px', fontWeight: 600 }}>{b.last_name} {b.first_name || b.user_name}</td>
                                      <td style={{ padding: '6px' }}>{b.user_phone || '-'}</td>
                                      <td style={{ padding: '6px' }}>{b.user_email}</td>
                                      <td style={{ padding: '6px' }}>
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          color: '#fff',
                                          backgroundColor: b.status === 'approved' ? '#16a34a' : b.status === 'approved_bot' ? '#0891b2' : '#eab308'
                                        }}>
                                          {b.status === 'approved' ? 'Одобрено' : b.status === 'approved_bot' ? 'Одобрено ботом' : 'Ожидает'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px' }}>
                                        <select
                                          value={b.status}
                                          onChange={(e) => handleUpdateBookingStatus(b, e.target.value)}
                                          style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}
                                        >
                                          <option value="pending">Ожидает</option>
                                          <option value="approved">Одобрить</option>
                                          <option value="rejected">Отклонить</option>
                                        </select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>На эту комнату нет активных бронирований.</p>
                            )}
                          </div>

                          {/* Форма редактирования параметров комнаты */}
                          <form onSubmit={handleSaveRoomDetailsLocally} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Пол комнаты</label>
                              <select
                                value={selectedRoom.gender || 'DEFAULT'}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, gender: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                <option value="DEFAULT">По умолчанию от этажа/корпуса</option>
                                <option value="MIXED">Смешанный (С)</option>
                                <option value="M">Мужской (М)</option>
                                <option value="F">Женский (Ж)</option>
                              </select>
                            </div>

                            <div style={{ gridColumn: '1 / -1', marginTop: '10px', display: 'flex', gap: '10px' }}>
                              <button type="submit" className="btn btn-primary" disabled={savingRoom} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <SquareCheck size={16} /> Применить локально
                              </button>

                              {isEditLayout && (
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  onClick={() => {
                                    setLocalRooms((prev) => prev.filter((r) => !(Number(r.x_pos) === Number(selectedRoom.x_pos) && Number(r.y_pos) === Number(selectedRoom.y_pos))));
                                    setHasUnsavedChanges(true);
                                    setSelectedRoom(null);
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <Trash2 size={16} /> Удалить комнату
                                </button>
                              )}
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Нажмите "+ Добавить этаж" для создания первого этажа.</p>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94a3b8' }}>Выберите или создайте корпус в меню слева.</p>
              )}
            </div>

          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ЭТАЖА */}
        {showAddFloorModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '420px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Добавление этажа</h3>
              <form onSubmit={handleCreateFloorSubmit}>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Номер создаваемого этажа</label>
                  <input
                    type="number"
                    min={1}
                    value={newFloorNumberInput}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      setNewFloorNumberInput(num);
                    }}
                    required
                  />
                </div>

                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>
                    С какого номера начинается нумерация комнат на этом этаже?
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newFloorStartRoomNum}
                    onChange={(e) => setNewFloorStartRoomNum(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Рассчитывать автоматически"
                  />
                  <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                    Оставьте пустым, чтобы нумерация продолжилась с предыдущего этажа.
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddFloorModal(false)}>Отмена</button>
                  <button type="submit" className="btn btn-primary">Создать этаж</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ */}
        {deleteConfirmTarget && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', marginBottom: '12px' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0, fontSize: '18px' }}>Подтверждение удаления</h3>
              </div>
              <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
                Вы действительно хотите удалить {deleteConfirmTarget.type === 'building' ? 'корпус' : deleteConfirmTarget.type === 'floor' ? 'этаж' : 'комнату'} <strong>«{deleteConfirmTarget.name}»</strong>? Все связанные данные также будут удалены.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteConfirmTarget(null)}>Отмена</button>
                <button className="btn btn-danger" onClick={confirmDelete}>Удалить</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};