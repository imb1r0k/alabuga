import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { useOrientation } from '../../hooks/useOrientation';
import { useToast } from '../../components/Toast';
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
  RotateCcw,
  Hash,
  Pencil
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

// Улучшенная, понятная и четкая иконка лестницы
const StairsIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19h4v-4h4v-4h4V7h4" />
    <path d="M4 19v-4" opacity="0.4" />
    <path d="M8 15v-4" opacity="0.4" />
    <path d="M12 11v-4" opacity="0.4" />
  </svg>
);

const STANDARD_TEMPLATES: TileTemplate[] = [
  { type: 'room', title: 'Комната', icon: Bed, bg: '#d1e7dd', borderColor: '#a3cfbb', textColor: '#0f5132' },
  { type: 'elevator', title: 'Лифт', icon: ArrowUpDown, bg: '#cff4fc', borderColor: '#9eeaf9', textColor: '#055160' },
  { type: 'stairs', title: 'Лестница', icon: StairsIcon, bg: '#fff3cd', borderColor: '#ffe69c', textColor: '#664d03' },
  { type: 'tech', title: 'Техническая', icon: Wrench, bg: '#e2e3e5', borderColor: '#c4c8cb', textColor: '#41464b' },
];

const GEN_TEMPLATES: TileTemplate[] = [
  { type: 'gen-start', title: 'Начало генерации', icon: Play, bg: '#d1e7dd', borderColor: '#198754', textColor: '#0f5132' },
  { type: 'gen-turn', title: 'Поворот генерации', icon: RotateCw, bg: '#cff4fc', borderColor: '#0dcaf0', textColor: '#055160' },
  { type: 'gen-end', title: 'Конец генерации', icon: Square, bg: '#f8d7da', borderColor: '#dc3545', textColor: '#842029' },
];

const GenderBadge: React.FC<{ gender?: string; size?: number }> = ({ gender = 'MIXED', size = 20 }) => {
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

export const AdminBuildingsPage: React.FC = () => {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [localRooms, setLocalRooms] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [roomBookings, setRoomBookings] = useState<any[]>([]);

  // Режим редактирования
  const [isEditLayout, setIsEditLayout] = useState(false);
  const isPortrait = useOrientation();
  const { showToast } = useToast();
  const showVertical = isPortrait;

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
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'building' | 'floor' | 'room'; id: number; name: string } | null>(null);

  // Генерация & инструментарий
  const [genMode, setGenMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<TileType>('room');
  const [selectedDir, setSelectedDir] = useState<Direction>('right');

  // Drag & drop локальной плитки (для перетаскивания и обмена местами)
  const [draggedItem, setDraggedItem] = useState<{ isExisting: boolean; type?: TileType; x?: number; y?: number } | null>(null);

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
      setNewBuildingName('');
      showToast('Корпус успешно создан', 'success');
      loadBuildings();
      loadAllBookingsAndRooms();
    } catch (err: any) {
      showToast('Ошибка при создании корпуса: ' + (err.response?.data?.error || err.message), 'error');
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
      setShowAddFloorModal(false);
      showToast(`Этаж ${newFloorNumberInput} успешно создан`, 'success');
      handleSelectBuilding(selectedBuilding);
    } catch (err: any) {
      showToast('Ошибка при создании этажа: ' + (err.response?.data?.error || err.message), 'error');
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
    const { type, id } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    try {
      if (type === 'building') {
        await deleteAdminBuilding(id);
        loadBuildings();
        loadAllBookingsAndRooms();
      } else if (type === 'floor') {
        await deleteAdminFloor(id);
        handleSelectBuilding(selectedBuilding);
        loadAllBookingsAndRooms();
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

  const placeTileLocally = (x: number, y: number, type: TileType, dir: Direction = 'right') => {
    if (!isEditLayout || y === 1 || !selectedFloor || !selectedBuilding) return;

    const existing = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === y);
    const autoNum = `${getCalculatedRoomNumber(x, y)}`;

    let name = 'Комната';
    let roomNumber = autoNum;
    let capacity = 2;
    let isTechnical = 0;

    if (type === 'elevator') {
      name = 'Лифт';
      roomNumber = 'Лифт';
      capacity = 0;
    } else if (type === 'stairs') {
      name = 'Лестница';
      roomNumber = 'Лестница';
      capacity = 0;
    } else if (type === 'tech') {
      name = 'Техническое';
      roomNumber = autoNum;
      capacity = 0;
      isTechnical = 1;
    } else if (type === 'gen-start') {
      name = `[Старт -> ${dir}]`;
      roomNumber = autoNum;
      capacity = 0;
      isTechnical = 1;
    } else if (type === 'gen-turn') {
      name = `[Поворот -> ${dir}]`;
      roomNumber = autoNum;
      capacity = 0;
      isTechnical = 1;
    } else if (type === 'gen-end') {
      name = '[Конец]';
      roomNumber = autoNum;
      capacity = 0;
      isTechnical = 1;
    } else {
      name = `Комната ${autoNum}`;
      roomNumber = existing?.room_number || autoNum;
    }

    const roomData = {
      id: existing?.id,
      floor_id: Number(selectedFloor.id),
      building_id: Number(selectedBuilding.id),
      room_number: roomNumber,
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

  // Старт перетаскивания (для заготовки или существующей плитки)
  const handleDragStartTool = (e: React.DragEvent, type: TileType) => {
    if (!isEditLayout) return;
    setDraggedItem({ isExisting: false, type });
    try {
      e.dataTransfer.setData('text/plain', type);
      e.dataTransfer.effectAllowed = 'copy';
    } catch (_) {}
  };

  const handleDragStartExistingTile = (e: React.DragEvent, room: any) => {
    if (!isEditLayout) return;
    setDraggedItem({ isExisting: true, x: Number(room.x_pos), y: Number(room.y_pos) });
    try {
      e.dataTransfer.setData('text/plain', 'existing_tile');
      e.dataTransfer.effectAllowed = 'move';
    } catch (_) {}
  };

  // Обработка Дропа с поддержкой анимированного обмена местами!
  const handleDrop = (e: React.DragEvent, dropX: number, dropY: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditLayout || dropY === 1 || !selectedFloor) return;

    if (draggedItem?.isExisting && draggedItem.x !== undefined && draggedItem.y !== undefined) {
      const dragX = draggedItem.x;
      const dragY = draggedItem.y;

      if (dragX === dropX && dragY === dropY) return;

      setLocalRooms((prevRooms) => {
        const itemInDropPos = prevRooms.find((r) => Number(r.x_pos) === dropX && Number(r.y_pos) === dropY);

        return prevRooms.map((r) => {
          if (Number(r.x_pos) === dragX && Number(r.y_pos) === dragY) {
            return { ...r, x_pos: dropX, y_pos: dropY };
          }
          if (itemInDropPos && Number(r.x_pos) === dropX && Number(r.y_pos) === dropY) {
            return { ...r, x_pos: dragX, y_pos: dragY };
          }
          return r;
        });
      });

      setHasUnsavedChanges(true);
      setDraggedItem(null);
      return;
    }

    // Если перетаскивали новую заготовку
    let typeToPlace = draggedItem?.type || selectedTool;
    try {
      const textData = e.dataTransfer.getData('text/plain') as TileType;
      if (textData && ['room', 'elevator', 'stairs', 'tech', 'gen-start', 'gen-turn', 'gen-end'].includes(textData)) {
        typeToPlace = textData;
      }
    } catch (_) {}

    placeTileLocally(dropX, dropY, typeToPlace, selectedDir);
    setDraggedItem(null);
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

  // АВТОГЕНЕРАЦИЯ С ПРОПУСКОМ ЗАНИТЫХ ЯЧЕЕК И АВТОМАТИЧЕСКИМ ВЫХОДОМ
  const handleRunGeneration = () => {
    if (!selectedFloor || !selectedBuilding) return;
    setGenStatusMsg('Генерация макета...');

    const startRoom = localRooms.find((r) => r.room_type === 'gen-start');
    if (!startRoom) {
      showToast('Ошибка: Поместите маркер "Начало генерации" ▶ на сетку', 'error');
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
      const existingInCell = newRoomsList.find((r) => Number(r.x_pos) === rX && Number(r.y_pos) === rY);

      // Если в ячейке НЕ маркер генерации, а сушествующая лестница, лифт, тех. помещение или комната — ПРОПУСКАЕМ ячейку!
      if (existingInCell && !['gen-start', 'gen-turn', 'gen-end'].includes(existingInCell.room_type)) {
        // Пропускаем ячейку
      } else {
        const generatedRoom = {
          id: existingInCell?.id,
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

        const existingIdx = newRoomsList.findIndex((r) => Number(r.x_pos) === rX && Number(r.y_pos) === rY);
        if (existingIdx >= 0) {
          newRoomsList[existingIdx] = generatedRoom;
        } else {
          newRoomsList.push(generatedRoom);
        }

        placedCount++;
        currentNum++;
      }

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
    setGenMode(false); // Автоматически выходим из режима генерации!
    showToast(`Успешно сгенерировано ${placedCount} комнат! Нажмите «Сохранить макет».`, 'success');
  };

  const handleSaveFullLayout = async () => {
    if (!selectedFloor) return;
    setSavingLayout(true);
    try {
      await saveAdminFloor(selectedFloor);

      const currentRemote = rooms;
      for (const remoteR of currentRemote) {
        const existsInLocal = localRooms.some((l) => l.id === remoteR.id);
        if (!existsInLocal) {
          await deleteAdminRoom(remoteR.id);
        }
      }

      for (const room of localRooms) {
        await saveAdminRoom(room);
      }

      const updatedRooms = await getAdminRooms(selectedFloor.id);
      setRooms(updatedRooms);
      setLocalRooms(updatedRooms);
      setHasUnsavedChanges(false);
      loadAllBookingsAndRooms();
      showToast('Макет этажа успешно сохранен в базе данных!', 'success');
    } catch (err: any) {
      showToast('Ошибка при сохранении макета: ' + err.message, 'error');
    } finally {
      setSavingLayout(false);
    }
  };

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
      loadAllBookingsAndRooms();
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

  // Рендер ячейки
  const renderCellTile = (x: number, y: number) => {
    const room = localRooms.find((r) => Number(r.x_pos) === x && Number(r.y_pos) === y);
    const calcRoomNum = getCalculatedRoomNumber(x, y);
    const tmpl = [...STANDARD_TEMPLATES, ...GEN_TEMPLATES].find((t) => t.type === room?.room_type);
    const IconComp = tmpl?.icon || Bed;
    const effectiveRoomGender = getEffectiveGender(room?.gender, selectedFloor?.gender);
    const bookedCount = room && room.room_type === 'room' && room.id ? getRoomOccupancy(room.id) : 0;

    // Определяем, что показывать как номер/название
    let displayNumber = room?.room_number || '';
    let displayName = room?.name || '';
    
    // Для лестницы и лифта показываем название вместо номера
    if (room?.room_type === 'stairs' || room?.room_type === 'elevator') {
      displayNumber = room.name;
    }

    return (
      <div
        key={`cell-${x}-${y}`}
        draggable={isEditLayout && !!room}
        onDragStart={(e) => room && handleDragStartExistingTile(e, room)}
        onClick={() => handleCellClick(x, y)}
        onDragOver={(e) => isEditLayout && e.preventDefault()}
        onDrop={(e) => isEditLayout && handleDrop(e, x, y)}
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
          cursor: isEditLayout ? (room ? 'grab' : 'pointer') : 'pointer',
          fontSize: '13px',
          padding: '4px',
          textAlign: 'center',
          position: 'relative',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {room && (
          <div style={{ position: 'absolute', top: '3px', right: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <GenderBadge gender={effectiveRoomGender} size={18} />
            {isEditLayout && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLocalRooms((prev) => prev.filter((r) => !(Number(r.x_pos) === x && Number(r.y_pos) === y)));
                  setHasUnsavedChanges(true);
                }}
                title="Удалить"
                style={{ border: 'none', background: 'rgba(239, 68, 68, 0.85)', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
              >
                <X size={9} />
              </button>
            )}
          </div>
        )}

        {room ? (
          <div style={{ transform: showVertical ? 'rotate(90deg)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <IconComp size={24} style={{ marginBottom: '3px', marginTop: '4px' }} />
            <strong>{displayNumber || displayName}</strong>

            {room.room_type === 'room' && (
              <span style={{ fontSize: '12px', marginTop: '2px', fontWeight: 600, color: bookedCount >= room.capacity ? '#dc2626' : '#16a34a' }}>
                {bookedCount} / {room.capacity}
              </span>
            )}

            {isEditLayout && (room.room_type === 'gen-start' || room.room_type === 'gen-turn') && (
              <div style={{ display: 'flex', gap: '3px', marginTop: '4px', backgroundColor: 'rgba(255,255,255,0.85)', padding: '2px 4px', borderRadius: '4px', zIndex: 10 }}>
                {([
                  { dir: 'right', icon: ArrowRight },
                  { dir: 'down', icon: ArrowDown },
                  { dir: 'left', icon: ArrowLeft },
                  { dir: 'up', icon: ArrowUp },
                ] as const).map(({ dir: dVal, icon: IconD }) => (
                  <button
                    key={dVal}
                    type="button"
                    onClick={(e) => handleSetDirectionForCell(e, room, dVal)}
                    style={{
                      padding: '1px',
                      border: 'none',
                      borderRadius: '3px',
                      background: room.name.includes(dVal) ? '#0284c7' : 'transparent',
                      color: room.name.includes(dVal) ? '#fff' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={`Повернуть: ${dVal}`}
                  >
                    <IconD size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ transform: showVertical ? 'rotate(90deg)' : 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', display: 'block', fontWeight: 'bold', color: '#cbd5e1' }}>№ {calcRoomNum}</span>
            {isEditLayout ? '+ Пусто' : 'Свободно'}
          </div>
        )}
      </div>
    );
  };

  const floorWidth = Number(selectedFloor?.width) || 8;

  const cellSize = 145;
  const corridorHeight = 40;
  const gridGap = 10;
  const gridHeight = 110 * 2 + corridorHeight + gridGap * 2;
  const gridWidth = floorWidth * cellSize + (floorWidth - 1) * gridGap;

  return (
    <AdminLayout>
      <div style={{ width: '100%' }}>
        {buildingsLoading ? (
          <Skeleton width="100%" height={250} />
        ) : (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'nowrap', width: '100%' }}>
            
            {/* Сайдбар выбора корпуса */}
            <div style={{ width: '250px', flexShrink: 0, backgroundColor: '#fff', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', color: '#1e293b' }}>Список корпусов</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {buildings.map((b) => {
                  const bStats = getBuildingStats(b.id);
                  return (
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
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: selectedBuilding?.id === b.id ? 600 : 400
                        }}
                      >
                        <GenderBadge gender={b.gender} size={22} />
                        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{b.name}</span>
                          <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: 400 }}>
                            ({bStats.booked} / {bStats.total} мест)
                          </span>
                        </div>
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
                  );
                })}
              </div>

              <form onSubmit={handleAddBuilding} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h5 style={{ fontSize: '13px', marginBottom: '10px', color: '#64748b' }}>+ Новый корпус</h5>
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
                  <option value="MIXED">Смешанный (С)</option>
                  <option value="M">Мужской (М)</option>
                  <option value="F">Женский (Ж)</option>
                </select>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} disabled={savingBuilding}>
                  <Plus size={16} /> Создать корпус
                </button>
              </form>
            </div>

            {/* Основной редактор этажей */}
            <div style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
              {selectedBuilding ? (
                <div style={{ width: '100%' }}>
                  {/* Стабильная шапка корпуса без смещений */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <GenderBadge gender={selectedBuilding.gender} size={28} />
                      <h2 style={{ fontSize: '20px', color: '#0f172a', margin: 0, fontWeight: 700 }}>{selectedBuilding.name}</h2>
                      {(() => {
                        const bStats = getBuildingStats(selectedBuilding.id);
                        return (
                          <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            Занято: {bStats.booked} / {bStats.total} мест
                          </span>
                        );
                      })()}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                            <Save size={16} /> {savingLayout ? 'Сохранение...' : '💾 Сохранить'}
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
                        {isEditLayout ? 'Просмотр' : '✏️ Редактировать'}
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

                  {/* Список этажей */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    {floors.map((f) => {
                      const effectiveFloorGender = getEffectiveGender(f.gender, selectedBuilding.gender);
                      const fStats = getSpecificFloorStats(f.id);

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
                            Этаж {f.floor_number} ({fStats.booked}/{fStats.total})
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
                      {/* Панель настроек этажа в режиме редактирования */}
                      {isEditLayout && (
                        <div style={{
                          backgroundColor: '#f8fafc',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          marginBottom: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '16px',
                          fontSize: '13px'
                        }}>
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
                            <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Нач. №:</label>
                            <input
                              type="number"
                              placeholder="Авто"
                              value={selectedFloor.start_room_number || ''}
                              onChange={(e) => handleUpdateFloorStartRoomNum(e.target.value ? Number(e.target.value) : null)}
                              style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Порядок:</label>
                            <select
                              value={selectedFloor.room_order_type || 'clockwise'}
                              onChange={(e) => handleUpdateFloorOrderType(e.target.value as any)}
                              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="clockwise">По часовой</option>
                              <option value="column_wise">Сверху вниз</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ marginRight: '6px', fontWeight: 500, color: '#475569' }}>Пол:</label>
                            <select
                              value={selectedFloor.gender || 'DEFAULT'}
                              onChange={(e) => handleUpdateFloorGender(e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="DEFAULT">От корпуса</option>
                              <option value="MIXED">Смешанный</option>
                              <option value="M">Мужской</option>
                              <option value="F">Женский</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Палитра плиток */}
                      {isEditLayout && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                            {genMode ? 'Маркеры автогенерации:' : 'Заготовки помещений (Drag & Drop):'}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {(genMode ? GEN_TEMPLATES : STANDARD_TEMPLATES).map((tmpl) => {
                              const IconComp = tmpl.icon;
                              const isSelected = selectedTool === tmpl.type;
                              return (
                                <div
                                  key={tmpl.type}
                                  draggable
                                  onDragStart={(e) => handleDragStartTool(e, tmpl.type)}
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
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Нач. кв.:</label>
                              <input type="number" value={genFrom} onChange={(e) => setGenFrom(Number(e.target.value))} style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Кон. кв.:</label>
                              <input type="number" value={genTo} onChange={(e) => setGenTo(Number(e.target.value))} style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>Мест:</label>
                              <input type="number" value={genSeats} onChange={(e) => setGenSeats(Number(e.target.value))} style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6' }} />
                            </div>
                            <button onClick={handleRunGeneration} className="btn btn-primary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#7c3aed' }}>
                              <Play size={16} /> Запустить
                            </button>
                          </div>
                          {genStatusMsg && <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: genStatusMsg.includes('Ошибка') ? '#dc2626' : '#15803d' }}>{genStatusMsg}</div>}
                        </div>
                      )}

                      {/* СЕТКА ЭТАЖА */}
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
                                {selectedRoom.room_type === 'stairs' || selectedRoom.room_type === 'elevator' 
                                  ? selectedRoom.name 
                                  : `Комната ${selectedRoom.room_number || selectedRoom.name}`}
                              </h3>
                            </div>
                            <button onClick={() => setSelectedRoom(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                          </div>

                          <div style={{ marginBottom: '20px', backgroundColor: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Users size={16} /> Бронирования ({roomBookings.length} / {selectedRoom.capacity} мест)
                            </h4>

                            {roomBookings.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#64748b' }}>
                                      <th style={{ padding: '6px', textAlign: 'left' }}>#</th>
                                      <th style={{ padding: '6px', textAlign: 'left' }}>ФИО</th>
                                      <th style={{ padding: '6px', textAlign: 'left' }}>Тел.</th>
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
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Нет бронирований.</p>
                            )}
                          </div>

                          <form onSubmit={handleSaveRoomDetailsLocally} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Номер</label>
                              <input
                                type="text"
                                value={selectedRoom.room_number || ''}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, room_number: e.target.value })}
                                disabled={selectedRoom.room_type === 'stairs' || selectedRoom.room_type === 'elevator'}
                              />
                            </div>

                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Название</label>
                              <input
                                type="text"
                                value={selectedRoom.name || ''}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, name: e.target.value })}
                              />
                            </div>

                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Вместимость</label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={selectedRoom.capacity}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, capacity: Number(e.target.value) })}
                                disabled={selectedRoom.room_type === 'stairs' || selectedRoom.room_type === 'elevator'}
                              />
                            </div>

                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600 }}>Пол</label>
                              <select
                                value={selectedRoom.gender || 'DEFAULT'}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, gender: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                <option value="DEFAULT">По умолчанию</option>
                                <option value="MIXED">Смешанный</option>
                                <option value="M">Мужской</option>
                                <option value="F">Женский</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2 mt-2 flex gap-2">
                              <button type="submit" className="btn btn-primary flex-1" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <SquareCheck size={16} /> Применить
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
                                  <Trash2 size={16} /> Удалить
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
            zIndex: 1000,
            padding: '16px'
          }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '440px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Добавление этажа</h3>
              <form onSubmit={handleCreateFloorSubmit}>
                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Номер создаваемого этажа</label>
                  <input
                    type="number"
                    min={1}
                    value={newFloorNumberInput}
                    onChange={(e) => setNewFloorNumberInput(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Нумерация комнат</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div
                      onClick={() => setStartNumMode('default')}
                      style={{
                        border: `2px solid ${startNumMode === 'default' ? '#0284c7' : '#cbd5e1'}`,
                        borderRadius: '10px',
                        padding: '14px 12px',
                        cursor: 'pointer',
                        backgroundColor: startNumMode === 'default' ? '#f0f9ff' : '#fff',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        textAlign: 'center'
                      }}
                    >
                      <Hash size={24} color={startNumMode === 'default' ? '#0284c7' : '#64748b'} />
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>Автоматически</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Начнёт с №{getDefaultNextStartRoomNum()}</span>
                    </div>

                    <div
                      onClick={() => setStartNumMode('custom')}
                      style={{
                        border: `2px solid ${startNumMode === 'custom' ? '#0284c7' : '#cbd5e1'}`,
                        borderRadius: '10px',
                        padding: '14px 12px',
                        cursor: 'pointer',
                        backgroundColor: startNumMode === 'custom' ? '#f0f9ff' : '#fff',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        textAlign: 'center'
                      }}
                    >
                      <Pencil size={24} color={startNumMode === 'custom' ? '#0284c7' : '#64748b'} />
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>Указать вручную</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Введите свой номер</span>
                    </div>
                  </div>

                  {startNumMode === 'custom' && (
                    <input
                      type="number"
                      min={1}
                      value={customStartRoomNum}
                      onChange={(e) => setCustomStartRoomNum(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Введите начальный номер, например 101"
                      style={{ marginTop: '10px', paddingLeft: '10px' }}
                      required
                      autoFocus
                    />
                  )}
                </div>

                <div className="input-group">
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Порядок комнат на этаже</label>
                  <select
                    value={newFloorOrderType}
                    onChange={(e) => setNewFloorOrderType(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  >
                    <option value="clockwise">По часовой (слева направо сверху, справа налево снизу)</option>
                    <option value="column_wise">Сверху вниз (по столбцам слева направо)</option>
                  </select>
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
            zIndex: 1000,
            padding: '16px'
          }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
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