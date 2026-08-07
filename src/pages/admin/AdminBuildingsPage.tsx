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
  getAllRooms
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
  Trash2,
  Users,
  AlertTriangle,
  Save,
  RotateCcw,
  Building2,
  Layers
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
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
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
  
  // Комнаты
  const [allRooms, setAllRooms] = useState<any[]>([]);
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
  
  // Добавление корпуса
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingGender, setNewBuildingGender] = useState<'M' | 'F' | 'MIXED'>('MIXED');

  // Окно создания этажа
  const [showAddFloorModal, setShowAddFloorModal] = useState(false);
  const [newFloorNumberInput, setNewFloorNumberInput] = useState<number>(1);
  const [startNumMode, setStartNumMode] = useState<'default' | 'custom'>('default');
  const [customStartRoomNum, setCustomStartRoomNum] = useState<number | ''>('');
  const [newFloorOrderType, setNewFloorOrderType] = useState<'clockwise' | 'column_wise'>('clockwise');

  // Подтверждение удаления
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'building' | 'floor' | 'room'; id?: number; x?: number; y?: number; name: string } | null>(null);

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
    loadAllBookingsAndRooms();
  }, []);

  const loadAllBookingsAndRooms = async () => {
    try {
      const [bData, rData] = await Promise.all([getAdminBookings(), getAllRooms()]);
      setAllBookings(bData);
      setAllRooms(rData);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
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
      toast.error('Не удалось загрузить список корпусов');
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

      const startNum = calculateFloorStartRoomNumber(f, currentFloorsList);
      setGenFrom(startNum);
      setGenTo(startNum + (Number(f.width) || 8) * 2 - 1);
    } catch (err) {
      console.error(err);
    }
  };

  const calculateFloorStartRoomNumber = (targetFloor: any, floorsList = floors) => {
    if (targetFloor.start_room_number && Number(targetFloor.start_room_number) > 0) {
      return Number(targetFloor.start_room_number);
    }
    const lowerFloors = floorsList.filter((f) => Number(f.floor_number) < Number(targetFloor.floor_number));
    let start = 1;
    for (const lf of lowerFloors) {
      const cellsCount = (Number(lf.width) || 8) * 2;
      start += cellsCount;
    }
    return start;
  };

  const getCellIndex = (x: number, y: number, width: number, orderType: string = 'clockwise') => {
    if (orderType === 'column_wise') {
      return y === 0 ? x * 2 + 1 : x * 2 + 2;
    } else {
      return y === 0 ? x + 1 : width * 2 - x;
    }
  };

  const getCalculatedRoomNumber = (x: number, y: number) => {
    if (!selectedFloor) return 1;
    const width = Number(selectedFloor.width) || 8;
    const cellIdx = getCellIndex(x, y, width, selectedFloor.room_order_type || 'clockwise');
    const floorStart = calculateFloorStartRoomNumber(selectedFloor);
    return floorStart + cellIdx - 1;
  };

  const getBuildingStats = (buildingId: number) => {
    const bRooms = allRooms.filter((r) => Number(r.building_id) === Number(buildingId) && r.room_type === 'room');
    const totalCapacity = bRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);
    const bookedSeats = allBookings.filter((b) => Number(b.building_id) === Number(buildingId) && b.status !== 'rejected').length;
    return { booked: bookedSeats, total: totalCapacity };
  };

  const getSpecificFloorStats = (floorId: number) => {
    const floorRooms = (selectedFloor?.id === floorId ? localRooms : allRooms.filter((r) => Number(r.floor_id) === Number(floorId))).filter((r) => r.room_type === 'room');
    const totalCapacity = floorRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);
    const bookedSeats = floorRooms.reduce((sum, r) => sum + (r.id ? getRoomOccupancy(r.id) : 0), 0);
    return { booked: bookedSeats, total: totalCapacity };
  };

  const getRoomOccupancy = (roomId: number) => {
    return allBookings.filter((b) => Number(b.room_id) === Number(roomId) && b.status !== 'rejected').length;
  };

  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuildingName.trim()) return;
    setSavingBuilding(true);
    try {
      await saveAdminBuilding({ name: newBuildingName, gender: newBuildingGender });
      toast.success(`Корпус «${newBuildingName}» успешно создан!`);
      setNewBuildingName('');
      loadBuildings();
      loadAllBookingsAndRooms();
    } catch (err: any) {
      toast.error('Ошибка создания корпуса: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingBuilding(false);
    }
  };

  const openAddFloorModal = () => {
    const maxFloorNum = floors.reduce((max, f) => Math.max(max, Number(f.floor_number)), 0);
    const nextNum = maxFloorNum + 1;
    setNewFloorNumberInput(nextNum);
    setStartNumMode('default');
    setCustomStartRoomNum('');
    setNewFloorOrderType('clockwise');
    setShowAddFloorModal(true);
  };

  const getDefaultNextStartRoomNum = () => {
    if (floors.length === 0) return 1;
    const maxPrevFloor = floors.reduce((prev, current) => (Number(current.floor_number) > Number(prev.floor_number) ? current : prev), floors[0]);
    const prevStart = calculateFloorStartRoomNumber(maxPrevFloor);
    const prevCapacity = (Number(maxPrevFloor.width) || 8) * 2;
    return prevStart + prevCapacity;
  };

  const handleCreateFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding) return;

    let startNum: number | null = null;
    if (startNumMode === 'custom' && customStartRoomNum !== '') {
      startNum = Number(customStartRoomNum);
    } else {
      startNum = getDefaultNextStartRoomNum();
    }

    try {
      await saveAdminFloor({
        building_id: selectedBuilding.id,
        floor_number: newFloorNumberInput,
        width: 8,
        gender: 'DEFAULT',
        start_room_number: startNum,
        room_order_type: newFloorOrderType,
      });
      toast.success(`Этаж ${newFloorNumberInput} успешно добавлен!`);
      setShowAddFloorModal(false);
      handleSelectBuilding(selectedBuilding);
    } catch (err: any) {
      toast.error('Ошибка создания этажа: ' + (err.response?.data?.error || err.message));
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

  const handleUpdateFloorOrderType = (orderType: 'clockwise' | 'column_wise') => {
    if (!selectedFloor) return;
    setSelectedFloor({ ...selectedFloor, room_order_type: orderType });
    setHasUnsavedChanges(true);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, id, x, y, name } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    try {
      if (type === 'building' && id) {
        await deleteAdminBuilding(id);
        toast.success(`Корпус «${name}» удален`);
        loadBuildings();
        loadAllBookingsAndRooms();
      } else if (type === 'floor' && id) {
        await deleteAdminFloor(id);
        toast.success(`Этаж «${name}» удален`);
        handleSelectBuilding(selectedBuilding);
        loadAllBookingsAndRooms();
      } else if (type === 'room' && x !== undefined && y !== undefined) {
        setLocalRooms((prev) => prev.filter((r) => !(Number(r.x_pos) === x && Number(r.y_pos) === y)));
        setHasUnsavedChanges(true);
        setSelectedRoom(null);
        toast.success(`Комната «${name}» удалена из локального макета`);
      }
    } catch (err: any) {
      toast.error('Ошибка при удалении: ' + (err.response?.data?.error || err.message));
    }
  };

  const getEffectiveGender = (targetGender?: string, parentGender?: string) => {
    if (targetGender && targetGender !== 'DEFAULT') return targetGender;
    if (parentGender && parentGender !== 'DEFAULT') return parentGender;
    return selectedBuilding?.gender || 'MIXED';
  };

  const placeTileLocally = (x: number, y: number, type: TileType, dir: Direction = 'right') => {
    if (!isEditLayout || y === 1 || !selectedFloor || !selectedBuilding) return;

    const existing = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === y);
    const autoNum = `${getCalculatedRoomNumber(x, y)}`;

    let name = 'Комната';
    let capacity = 2;
    let isTechnical = 0;

    if (type === 'elevator') { name = 'Лифт'; capacity = 0; }
    else if (type === 'stairs') { name = 'Лестница'; capacity = 0; }
    else if (type === 'tech') { name = 'Техническое'; capacity = 0; isTechnical = 1; }
    else if (type === 'gen-start') { name = `[Старт -> ${dir}]`; capacity = 0; isTechnical = 1; }
    else if (type === 'gen-turn') { name = `[Поворот -> ${dir}]`; capacity = 0; isTechnical = 1; }
    else if (type === 'gen-end') { name = '[Конец]'; capacity = 0; isTechnical = 1; }
    else { name = `Комната ${autoNum}`; }

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
        } catch (err) { console.error(err); }
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
    try { e.dataTransfer.setData('text/plain', type); e.dataTransfer.effectAllowed = 'copy'; } catch (_) {}
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

  const handleSetDirectionForCell = (e: React.MouseEvent, room: any, newDir: Direction) => {
    e.stopPropagation();
    e.preventDefault();
    let name = room.name;
    if (room.room_type === 'gen-start') name = `[Старт -> ${newDir}]`;
    if (room.room_type === 'gen-turn') name = `[Поворот -> ${newDir}]`;
    setSelectedDir(newDir);
    setLocalRooms((prev) =>
      prev.map((r) => (Number(r.x_pos) === Number(room.x_pos) && Number(r.y_pos) === Number(room.y_pos) ? { ...r, name } : r))
    );
    setHasUnsavedChanges(true);
  };

  const handleRunGeneration = () => {
    if (!selectedFloor || !selectedBuilding) return;
    setGenStatusMsg('Генерация макета...');

    const startRoom = localRooms.find((r) => r.room_type === 'gen-start');
    if (!startRoom) {
      const msg = 'Ошибка: Поместите маркер "Начало генерации" ▶ на сетку';
      setGenStatusMsg(msg);
      toast.error(msg);
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
      right: [1, 0], left: [-1, 0], down: [0, 2], up: [0, -2],
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
        newRoomsList[endIdx] = { ...nextTile, room_number: `${currentNum}`, name: `Комната ${currentNum}`, capacity: genSeats, is_technical: 0, room_type: 'room' };
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
    const successMsg = `Сгенерировано ${placedCount} комнат (${genFrom}–${genFrom + placedCount - 1}). Нажмите «Сохранить макет»`;
    setGenStatusMsg(`✅ ${successMsg}`);
    toast.success(successMsg);
  };

  const handleSaveFullLayout = async () => {
    if (!selectedFloor) return;
    setSavingLayout(true);
    try {
      await saveAdminFloor(selectedFloor);
      const currentRemote = rooms;
      for (const remoteR of currentRemote) {
        const existsInLocal = localRooms.some((l) => Number(l.x_pos) === Number(remoteR.x_pos) && Number(l.y_pos) === Number(remoteR.y_pos));
        if (!existsInLocal) await deleteAdminRoom(remoteR.id);
      }
      for (const room of localRooms) await saveAdminRoom(room);
      const updatedRooms = await getAdminRooms(selectedFloor.id);
      setRooms(updatedRooms);
      setLocalRooms(updatedRooms);
      setHasUnsavedChanges(false);
      loadAllBookingsAndRooms();
      toast.success('Макет этажа успешно сохранен!');
    } catch (err: any) {
      toast.error('Ошибка сохранения макета: ' + err.message);
    } finally {
      setSavingLayout(false);
    }
  };

  const handleResetLayout = () => {
    setLocalRooms([...rooms]);
    setHasUnsavedChanges(false);
    toast('Изменения сброшены', { icon: '🔄' });
  };

  const handleUpdateBookingStatus = async (booking: any, newStatus: string) => {
    try {
      await updateAdminBooking({ ...booking, status: newStatus });
      toast.success('Статус бронирования обновлен');
      if (selectedRoom?.id) {
        const bList = await getRoomBookings(selectedRoom.id);
        setRoomBookings(bList);
      }
      loadAllBookingsAndRooms();
    } catch (err) { toast.error('Ошибка обновления статуса'); }
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
    toast.success('Параметры комнаты изменены в локальном макете');
  };

  return (
    <AdminLayout>
      <div className="animate-fade-in" style={{ padding: '0 4px' }}>
        {buildingsLoading ? (
          <Skeleton width="100%" height={300} />
        ) : (
          <div className="admin-grid">
            {/* Левый сайдбар: Список корпусов */}
            <div className="admin-card admin-sidebar" style={{ padding: '18px', height: 'fit-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                <Building2 size={18} color="var(--accent-primary)" />
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Корпуса</h4>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', maxHeight: '350px', overflowY: 'auto' }}>
                {buildings.map((b) => {
                  const bStats = getBuildingStats(b.id);
                  const isSelected = selectedBuilding?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-app)',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 10px',
                        transition: 'var(--transition)'
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
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: isSelected ? 600 : 400
                        }}
                      >
                        <GenderBadge gender={b.gender} size={22} />
                        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{b.name}</span>
                          <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: 400 }}>({bStats.booked} / {bStats.total} мест)</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmTarget({ type: 'building', id: b.id, name: b.name }); }}
                        title="Удалить корпус"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: isSelected ? '#fca5a5' : '#ef4444', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddBuilding} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h5 style={{ fontSize: '12px', marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>+ Новый корпус</h5>
                <input type="text" placeholder="Название корпуса" value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} style={{ width: '100%', padding: '8px 10px', marginBottom: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '13px' }} required />
                <select value={newBuildingGender} onChange={(e) => setNewBuildingGender(e.target.value as any)} style={{ width: '100%', padding: '8px 10px', marginBottom: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                  <option value="MIXED">Смешанный (С)</option>
                  <option value="M">Мужской (М)</option>
                  <option value="F">Женский (Ж)</option>
                </select>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '13px' }} disabled={savingBuilding}>
                  <Plus size={15} /> Создать корпус
                </button>
              </form>
            </div>

            {/* Основной блок: Редактор корпуса */}
            <div className="admin-card admin-main" style={{ padding: '24px' }}>
              {selectedBuilding ? (
                <div>
                  {/* Заголовок */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <GenderBadge gender={selectedBuilding.gender} size={28} />
                      <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>{selectedBuilding.name}</h2>
                        {(() => { const bStats = getBuildingStats(selectedBuilding.id); return (<span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Всего занято: <strong>{bStats.booked}</strong> из <strong>{bStats.total}</strong> мест</span>); })()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {hasUnsavedChanges && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={handleSaveFullLayout} disabled={savingLayout} className="btn btn-success" style={{ fontWeight: 600 }}>
                            <Save size={15} /> {savingLayout ? 'Сохранение...' : 'Сохранить макет'}
                          </button>
                          <button onClick={handleResetLayout} disabled={savingLayout} className="btn btn-secondary"><RotateCcw size={15} /></button>
                        </div>
                      )}
                      <div onClick={() => { setIsEditLayout(!isEditLayout); if (isEditLayout) setGenMode(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: isEditLayout ? 'rgba(2, 132, 199, 0.1)' : 'var(--bg-app)', border: `1px solid ${isEditLayout ? 'var(--accent-primary)' : 'var(--border-color)'}`, cursor: 'pointer', transition: 'var(--transition)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isEditLayout ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{isEditLayout ? 'Редактирование' : 'Просмотр'}</span>
                        <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isEditLayout} onChange={() => { setIsEditLayout(!isEditLayout); if (isEditLayout) setGenMode(false); }} />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                      {isEditLayout && <button onClick={() => setGenMode(!genMode)} className="btn" style={{ fontSize: '12px', backgroundColor: genMode ? '#8b5cf6' : 'var(--bg-app)', color: genMode ? '#ffffff' : 'var(--text-primary)', border: '1px solid ' + (genMode ? '#8b5cf6' : 'var(--border-color)') }}><Zap size={15} /> {genMode ? 'Автогенерация' : 'Автогенерация'}</button>}
                      <button onClick={openAddFloorModal} className="btn btn-secondary" style={{ fontSize: '12px' }}><Plus size={15} /> Добавить этаж</button>
                    </div>
                  </div>

                  {/* Этажи */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {floors.map((f) => {
                      const effectiveFloorGender = getEffectiveGender(f.gender, selectedBuilding.gender);
                      const fStats = getSpecificFloorStats(f.id);
                      const isSelected = selectedFloor?.id === f.id;
                      return (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-app)', color: isSelected ? '#ffffff' : 'var(--text-primary)', border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-sm)', padding: '2px 8px', gap: '6px', transition: 'var(--transition)' }}>
                          <GenderBadge gender={effectiveFloorGender} size={18} />
                          <button onClick={() => handleSelectFloor(f)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontWeight: isSelected ? 600 : 400, fontSize: '13px', padding: '6px 2px' }}>Этаж {f.floor_number} ({fStats.booked}/{fStats.total})</button>
                          <button onClick={() => setDeleteConfirmTarget({ type: 'floor', id: f.id, name: `Этаж ${f.floor_number}` })} title="Удалить этаж" style={{ border: 'none', background: 'none', color: isSelected ? '#fca5a5' : '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                        </div>
                      );
                    })}
                  </div>

                  {selectedFloor ? (
                    <div>
                      {/* Панель опций этажа */}
                      {isEditLayout && (
                        <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '18px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Layers size={16} color="var(--accent-primary)" /><strong>Параметры этажа {selectedFloor.floor_number}:</strong></div>
                          <div><label style={{ marginRight: '6px', color: 'var(--text-secondary)' }}>Длина:</label><input type="number" min={3} max={20} value={selectedFloor.width || 8} onChange={(e) => handleUpdateFloorWidth(Number(e.target.value))} style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>
                          <div><label style={{ marginRight: '6px', color: 'var(--text-secondary)' }}>Стартовый №:</label><input type="number" placeholder="Авто" value={selectedFloor.start_room_number || ''} onChange={(e) => handleUpdateFloorStartRoomNum(e.target.value ? Number(e.target.value) : null)} style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>
                          <div><label style={{ marginRight: '6px', color: 'var(--text-secondary)' }}>Порядок:</label><select value={selectedFloor.room_order_type || 'clockwise'} onChange={(e) => handleUpdateFloorOrderType(e.target.value as any)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}><option value="clockwise">По часовой</option><option value="column_wise">Сверху вниз</option></select></div>
                          <div><label style={{ marginRight: '6px', color: 'var(--text-secondary)' }}>Пол:</label><select value={selectedFloor.gender || 'DEFAULT'} onChange={(e) => handleUpdateFloorGender(e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}><option value="DEFAULT">От корпуса</option><option value="MIXED">Смешанный (С)</option><option value="M">Мужской (М)</option><option value="F">Женский (Ж)</option></select></div>
                        </div>
                      )}

                      {/* Плитки */}
                      {isEditLayout && (
                        <div style={{ marginBottom: '18px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>{genMode ? 'Маркеры генерации:' : 'Заготовки элементов:'}</div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {(genMode ? GEN_TEMPLATES : STANDARD_TEMPLATES).map((tmpl) => {
                              const IconComp = tmpl.icon;
                              const isSelected = selectedTool === tmpl.type;
                              return (
                                <div key={tmpl.type} draggable onDragStart={(e) => handleDragStart(e, tmpl.type)} onClick={() => setSelectedTool(tmpl.type)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: tmpl.bg, border: `2px solid ${isSelected ? 'var(--accent-primary)' : tmpl.borderColor}`, color: tmpl.textColor, cursor: 'grab', userSelect: 'none', fontSize: '13px', fontWeight: 600, transition: 'var(--transition)' }}>
                                  <IconComp size={16} /><span>{tmpl.title}</span>{isSelected && <Check size={14} style={{ marginLeft: '4px' }} />}
                                </div>
                              );
                            })}
                            {genMode && (selectedTool === 'gen-start' || selectedTool === 'gen-turn') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', padding: '4px 10px', backgroundColor: '#f3e8ff', borderRadius: '6px', border: '1px solid #c084fc' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b21a8' }}>Направление:</span>
                                {([{ dir: 'right', icon: ArrowRight }, { dir: 'down', icon: ArrowDown }, { dir: 'left', icon: ArrowLeft }, { dir: 'up', icon: ArrowUp }] as const).map(({ dir, icon: IconD }) => (
                                  <button key={dir} type="button" onClick={() => setSelectedDir(dir)} style={{ border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', backgroundColor: selectedDir === dir ? '#7c3aed' : '#e9d5ff', color: selectedDir === dir ? '#fff' : '#6b21a8' }}><IconD size={13} /></button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Генератор */}
                      {isEditLayout && genMode && (
                        <div style={{ backgroundColor: '#f3e8ff', border: '2px dashed #8b5cf6', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}><Zap size={16} /> Генератор цепочки комнат</h4>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div><label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>От №:</label><input type="number" value={genFrom} onChange={(e) => setGenFrom(Number(e.target.value))} style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} /></div>
                            <div><label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>До №:</label><input type="number" value={genTo} onChange={(e) => setGenTo(Number(e.target.value))} style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} /></div>
                            <div><label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Мест:</label><input type="number" value={genSeats} onChange={(e) => setGenSeats(Number(e.target.value))} style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} /></div>
                            <button onClick={handleRunGeneration} className="btn btn-primary" style={{ fontSize: '12px', backgroundColor: '#7c3aed' }}><Play size={15} /> Сгенерировать</button>
                          </div>
                          {genStatusMsg && <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: genStatusMsg.includes('Ошибка') ? '#dc2626' : '#15803d' }}>{genStatusMsg}</div>}
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
                              <div key={`top-${x}`} onClick={() => handleCellClick(x, 0)} onDragOver={(e) => isEditLayout && e.preventDefault()} onDrop={(e) => isEditLayout && handleDrop(e, x, 0)} style={{ height: '95px', border: room ? `2px solid ${tmpl?.borderColor || 'var(--accent-primary)'}` : '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: room ? (tmpl?.bg || '#e0f2fe') : 'var(--bg-card)', color: tmpl?.textColor || 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '11px', padding: '4px', textAlign: 'center', position: 'relative', transition: 'var(--transition)' }}>
                                {room && (
                                  <div style={{ position: 'absolute', top: '3px', right: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <GenderBadge gender={effectiveRoomGender} size={15} />
                                    {isEditLayout && (
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmTarget({ type: 'room', x: x, y: 0, name: room.room_number || room.name }); }} title="Удалить помещение" style={{ border: 'none', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><X size={9} /></button>
                                    )}
                                  </div>
                                )}
                                {room ? (
                                  <>
                                    <IconComp size={18} style={{ marginBottom: '2px', marginTop: '4px' }} />
                                    <strong>{room.room_number || room.name}</strong>
                                    {room.room_type === 'room' && <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: 600, color: bookedCount >= room.capacity ? '#dc2626' : '#16a34a' }}>{bookedCount} / {room.capacity} мест</span>}
                                    {isEditLayout && (room.room_type === 'gen-start' || room.room_type === 'gen-turn') && (
                                      <div style={{ display: 'flex', gap: '2px', marginTop: '4px', backgroundColor: 'rgba(255,255,255,0.9)', padding: '2px 4px', borderRadius: '4px', zIndex: 10 }}>
                                        {([{ dir: 'right', icon: ArrowRight }, { dir: 'down', icon: ArrowDown }, { dir: 'left', icon: ArrowLeft }, { dir: 'up', icon: ArrowUp }] as const).map(({ dir: dVal, icon: IconD }) => (
                                          <button key={dVal} type="button" onClick={(e) => handleSetDirectionForCell(e, room, dVal)} style={{ padding: '1px', border: 'none', borderRadius: '3px', background: room.name.includes(dVal) ? 'var(--accent-primary)' : 'transparent', color: room.name.includes(dVal) ? '#fff' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={`Повернуть: ${dVal}`}><IconD size={10} /></button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}><span style={{ fontSize: '10px', display: 'block', fontWeight: 'bold', color: 'var(--text-muted)' }}>№ {calcRoomNum}</span>{isEditLayout ? '+ Пусто' : 'Свободно'}</div>
                                )}
                              </div>
                            );
                          })}

                          {/* КОРИДОР */}
                          <div style={{ gridColumn: `1 / span ${Number(selectedFloor.width) || 8}`, height: '32px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px' }}>═══ КОРИДОР ═══</div>

                          {/* НИЖНИЙ РЯД (y = 2) */}
                          {Array.from({ length: Number(selectedFloor.width) || 8 }).map((_, x) => {
                            const room = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === 2);
                            const calcRoomNum = getCalculatedRoomNumber(x, 2);
                            const tmpl = [...STANDARD_TEMPLATES, ...GEN_TEMPLATES].find((t) => t.type === room?.room_type);
                            const IconComp = tmpl?.icon || Bed;
                            const effectiveRoomGender = getEffectiveGender(room?.gender, selectedFloor.gender);
                            const bookedCount = room && room.room_type === 'room' && room.id ? getRoomOccupancy(room.id) : 0;

                            return (
                              <div key={`bot-${x}`} onClick={() => handleCellClick(x, 2)} onDragOver={(e) => isEditLayout && e.preventDefault()} onDrop={(e) => isEditLayout && handleDrop(e, x, 2)} style={{ height: '95px', border: room ? `2px solid ${tmpl?.borderColor || 'var(--accent-primary)'}` : '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: room ? (tmpl?.bg || '#e0f2fe') : 'var(--bg-card)', color: tmpl?.textColor || 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '11px', padding: '4px', textAlign: 'center', position: 'relative', transition: 'var(--transition)' }}>
                                {room && (
                                  <div style={{ position: 'absolute', top: '3px', right: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <GenderBadge gender={effectiveRoomGender} size={15} />
                                    {isEditLayout && (
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmTarget({ type: 'room', x: x, y: 2, name: room.room_number || room.name }); }} title="Удалить помещение" style={{ border: 'none', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><X size={9} /></button>
                                    )}
                                  </div>
                                )}
                                {room ? (
                                  <>
                                    <IconComp size={18} style={{ marginBottom: '2px', marginTop: '4px' }} />
                                    <strong>{room.room_number || room.name}</strong>
                                    {room.room_type === 'room' && <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: 600, color: bookedCount >= room.capacity ? '#dc2626' : '#16a34a' }}>{bookedCount} / {room.capacity} мест</span>}
                                    {isEditLayout && (room.room_type === 'gen-start' || room.room_type === 'gen-turn') && (
                                      <div style={{ display: 'flex', gap: '2px', marginTop: '4px', backgroundColor: 'rgba(255,255,255,0.9)', padding: '2px 4px', borderRadius: '4px', zIndex: 10 }}>
                                        {([{ dir: 'right', icon: ArrowRight }, { dir: 'down', icon: ArrowDown }, { dir: 'left', icon: ArrowLeft }, { dir: 'up', icon: ArrowUp }] as const).map(({ dir: dVal, icon: IconD }) => (
                                          <button key={dVal} type="button" onClick={(e) => handleSetDirectionForCell(e, room, dVal)} style={{ padding: '1px', border: 'none', borderRadius: '3px', background: room.name.includes(dVal) ? 'var(--accent-primary)' : 'transparent', color: room.name.includes(dVal) ? '#fff' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={`Повернуть: ${dVal}`}><IconD size={10} /></button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}><span style={{ fontSize: '10px', display: 'block', fontWeight: 'bold', color: 'var(--text-muted)' }}>№ {calcRoomNum}</span>{isEditLayout ? '+ Пусто' : 'Свободно'}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* МОДАЛЬНОЕ ОКНО КОМНАТЫ */}
                      {selectedRoom && (
                        <div style={{ marginTop: '20px', backgroundColor: 'var(--bg-app)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <GenderBadge gender={getEffectiveGender(selectedRoom.gender, selectedFloor.gender)} size={24} />
                              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Информация о комнате {selectedRoom.room_number || selectedRoom.name}</h3>
                            </div>
                            <button onClick={() => setSelectedRoom(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}>✕</button>
                          </div>

                          <div style={{ marginBottom: '20px', backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={16} /> Бронирования ({roomBookings.length} / {selectedRoom.capacity} мест)</h4>
                            {roomBookings.length > 0 ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead><tr style={{ borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)' }}><th style={{ padding: '6px', textAlign: 'left' }}>#</th><th style={{ padding: '6px', textAlign: 'left' }}>ФИО</th><th style={{ padding: '6px', textAlign: 'left' }}>Телефон</th><th style={{ padding: '6px', textAlign: 'left' }}>Статус</th><th style={{ padding: '6px', textAlign: 'left' }}>Действие</th></tr></thead>
                                <tbody>{roomBookings.map((b) => (
                                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '6px' }}>#{b.id}</td>
                                    <td style={{ padding: '6px', fontWeight: 600 }}>{b.last_name} {b.first_name || b.user_name}</td>
                                    <td style={{ padding: '6px' }}>{b.user_phone || '-'}</td>
                                    <td style={{ padding: '6px' }}><span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#fff', backgroundColor: b.status === 'approved' ? '#16a34a' : b.status === 'approved_bot' ? '#0891b2' : '#eab308' }}>{b.status === 'approved' ? 'Одобрено' : b.status === 'approved_bot' ? 'Одобрено ботом' : 'Ожидает'}</span></td>
                                    <td style={{ padding: '6px' }}><select value={b.status} onChange={(e) => handleUpdateBookingStatus(b, e.target.value)} style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}><option value="pending">Ожидает</option><option value="approved">Одобрить</option><option value="rejected">Отклонить</option></select></td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            ) : <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Нет активных бронирований.</p>}
                          </div>

                          <form onSubmit={handleSaveRoomDetailsLocally} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '12px', fontWeight: 600 }}>Номер</label><input type="text" value={selectedRoom.room_number} onChange={(e) => setSelectedRoom({ ...selectedRoom, room_number: e.target.value })} /></div>
                            <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '12px', fontWeight: 600 }}>Название</label><input type="text" value={selectedRoom.name || ''} onChange={(e) => setSelectedRoom({ ...selectedRoom, name: e.target.value })} /></div>
                            <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '12px', fontWeight: 600 }}>Вместимость</label><input type="number" min={0} max={10} value={selectedRoom.capacity} onChange={(e) => setSelectedRoom({ ...selectedRoom, capacity: Number(e.target.value) })} /></div>
                            <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '12px', fontWeight: 600 }}>Пол</label><select value={selectedRoom.gender || 'DEFAULT'} onChange={(e) => setSelectedRoom({ ...selectedRoom, gender: e.target.value })}><option value="DEFAULT">От этажа/корпуса</option><option value="MIXED">Смешанный (С)</option><option value="M">Мужской (М)</option><option value="F">Женский (Ж)</option></select></div>
                            <div style={{ gridColumn: '1 / -1', marginTop: '10px', display: 'flex', gap: '10px' }}>
                              <button type="submit" className="btn btn-primary" disabled={savingLayout}><SquareCheck size={16} /> Применить локально</button>
                              {isEditLayout && <button type="button" className="btn btn-danger" onClick={() => { setDeleteConfirmTarget({ type: 'room', x: Number(selectedRoom.x_pos), y: Number(selectedRoom.y_pos), name: selectedRoom.room_number || selectedRoom.name }); }}><Trash2 size={16} /> Удалить комнату</button>}
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нажмите "+ Добавить этаж" для создания первого этажа.</p>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>Выберите или создайте корпус в меню слева.</p>
              )}
            </div>

          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ЭТАЖА */}
        {showAddFloorModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="admin-card animate-fade-in" style={{ padding: '24px', maxWidth: '440px', width: '90%' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Добавление этажа</h3>
              <form onSubmit={handleCreateFloorSubmit}>
                <div className="input-group"><label style={{ fontSize: '13px', fontWeight: 600 }}>Номер создаваемого этажа</label><input type="number" min={1} value={newFloorNumberInput} onChange={(e) => setNewFloorNumberInput(Number(e.target.value))} required /></div>

                <div className="input-group" style={{ marginTop: '14px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Нумерация комнат</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="startNumMode" checked={startNumMode === 'default'} onChange={() => setStartNumMode('default')} />
                      <span>Нумерация по умолчанию (с <strong>№{getDefaultNextStartRoomNum()}</strong>)</span>
                    </label>
                    <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="startNumMode" checked={startNumMode === 'custom'} onChange={() => setStartNumMode('custom')} />
                      <span>Указать номер начала отсчета комнат</span>
                    </label>
                  </div>
                  {startNumMode === 'custom' && <input type="number" min={1} value={customStartRoomNum} onChange={(e) => setCustomStartRoomNum(e.target.value ? Number(e.target.value) : '')} placeholder="Введите начальный номер, например 101" style={{ marginTop: '8px' }} required />}
                </div>

                <div className="input-group" style={{ marginTop: '14px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Порядок комнат на этаже</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <label className="toggle-switch" style={{ fontSize: '13px' }}>
                      <span style={{ marginRight: '8px', color: newFloorOrderType === 'clockwise' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: newFloorOrderType === 'clockwise' ? 600 : 400 }}>По часовой</span>
                      <input type="checkbox" checked={newFloorOrderType === 'column_wise'} onChange={() => setNewFloorOrderType(newFloorOrderType === 'clockwise' ? 'column_wise' : 'clockwise')} />
                      <span className="toggle-slider"></span>
                      <span style={{ marginLeft: '8px', color: newFloorOrderType === 'column_wise' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: newFloorOrderType === 'column_wise' ? 600 : 400 }}>Сверху вниз</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddFloorModal(false)}>Отмена</button>
                  <button type="submit" className="btn btn-primary">Создать этаж</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ */}
        {deleteConfirmTarget && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="admin-card animate-fade-in" style={{ padding: '24px', maxWidth: '400px', width: '90%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-danger)', marginBottom: '12px' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0, fontSize: '18px' }}>Подтверждение удаления</h3>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Вы действительно хотите удалить {deleteConfirmTarget.type === 'building' ? 'корпус' : deleteConfirmTarget.type === 'floor' ? 'этаж' : 'комнату'} <strong>«{deleteConfirmTarget.name}»</strong>?
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