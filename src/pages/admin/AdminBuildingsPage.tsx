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
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingGender, setNewBuildingGender] = useState<'M' | 'F'>('M');

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

  const handleGenerateFloorLayout = async () => {
    if (!selectedFloor || !selectedBuilding) return;
    const width = selectedFloor.width || 8;
    try {
      for (let x = 0; x < width; x++) {
        const topRoomNumber = `${selectedFloor.floor_number}0${x * 2 + 1}`;
        await saveAdminRoom({
          floor_id: selectedFloor.id,
          building_id: selectedBuilding.id,
          room_number: topRoomNumber,
          name: `Комната ${topRoomNumber}`,
          capacity: 2,
          is_technical: 0,
          gender: 'DEFAULT',
          x_pos: x,
          y_pos: 0,
        });

        const botRoomNumber = `${selectedFloor.floor_number}0${x * 2 + 2}`;
        await saveAdminRoom({
          floor_id: selectedFloor.id,
          building_id: selectedBuilding.id,
          room_number: botRoomNumber,
          name: `Комната ${botRoomNumber}`,
          capacity: 2,
          is_technical: 0,
          gender: 'DEFAULT',
          x_pos: x,
          y_pos: 2,
        });
      }
      handleSelectFloor(selectedFloor);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (y === 1) return;
    const existing = rooms.find((r) => r.x_pos === x && r.y_pos === y);
    if (existing) {
      setSelectedRoom({ ...existing });
    } else {
      setSelectedRoom({
        floor_id: selectedFloor.id,
        building_id: selectedBuilding.id,
        room_number: `${selectedFloor.floor_number}0${x + 1}`,
        name: `Комната`,
        capacity: 2,
        is_technical: 0,
        gender: 'DEFAULT',
        x_pos: x,
        y_pos: y,
      });
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
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
      <div>
        {buildingsLoading ? (
          <Skeleton width="100%" height={250} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
            <div style={{ borderRight: '1px solid #eee', paddingRight: '15px' }}>
              <h4 style={{ marginBottom: '12px' }}>Список корпусов</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {buildings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBuilding(b)}
                    className={`btn ${selectedBuilding?.id === b.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{b.name}</span>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>({b.gender === 'M' ? 'Муж' : 'Жен'})</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddBuilding} style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <h5 style={{ marginBottom: '8px' }}>Добавить корпус</h5>
                <input
                  type="text"
                  placeholder="Название корпуса"
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  style={{ width: '100%', padding: '6px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  required
                />
                <select
                  value={newBuildingGender}
                  onChange={(e) => setNewBuildingGender(e.target.value as 'M' | 'F')}
                  style={{ width: '100%', padding: '6px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="M">Мужской корпус</option>
                  <option value="F">Женский корпус</option>
                </select>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '13px' }} disabled={savingBuilding}>
                  + Создать корпус
                </button>
              </form>
            </div>

            <div>
              {selectedBuilding ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3>Макет: {selectedBuilding.name}</h3>
                    <button onClick={handleAddFloor} className="btn btn-secondary" style={{ fontSize: '13px' }}>
                      + Добавить этаж
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {floors.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleSelectFloor(f)}
                        className={`btn ${selectedFloor?.id === f.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 14px', fontSize: '14px' }}
                      >
                        Этаж {f.floor_number}
                      </button>
                    ))}
                  </div>

                  {selectedFloor && (
                    <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', fontSize: '14px' }}>
                        <div>
                          <label style={{ marginRight: '8px' }}>Ширина сетки:</label>
                          <input
                            type="number"
                            min={3}
                            max={20}
                            value={selectedFloor.width || 8}
                            onChange={(e) => handleUpdateFloorWidth(Number(e.target.value))}
                            style={{ width: '60px', padding: '4px' }}
                          />
                        </div>

                        <div>
                          <label style={{ marginRight: '8px' }}>Пол этажа:</label>
                          <select
                            value={selectedFloor.gender || 'DEFAULT'}
                            onChange={(e) => handleUpdateFloorGender(e.target.value)}
                            style={{ padding: '4px' }}
                          >
                            <option value="DEFAULT">По умолчанию ({selectedBuilding.gender === 'M' ? 'Муж' : 'Жен'})</option>
                            <option value="M">Мужской</option>
                            <option value="F">Женский</option>
                          </select>
                        </div>

                        <button onClick={handleGenerateFloorLayout} className="btn btn-secondary" style={{ fontSize: '12px' }}>
                          ⚡ Сгенерировать комнаты
                        </button>
                      </div>

                      <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${selectedFloor.width || 8}, 80px)`,
                          gap: '6px',
                          justifyContent: 'start',
                        }}>
                          {Array.from({ length: selectedFloor.width || 8 }).map((_, x) => {
                            const room = rooms.find((r) => r.x_pos === x && r.y_pos === 0);
                            return (
                              <div
                                key={`top-${x}`}
                                onClick={() => handleCellClick(x, 0)}
                                style={{
                                  height: '70px',
                                  border: '2px dashed #bbb',
                                  borderRadius: '6px',
                                  backgroundColor: room ? (room.is_technical ? '#e2e3e5' : '#d1e7dd') : '#fff',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '2px',
                                  textAlign: 'center',
                                }}
                              >
                                {room ? (
                                  <>
                                    <strong>{room.room_number}</strong>
                                    <span>{room.is_technical ? 'Техническая' : `${room.capacity} мест`}</span>
                                  </>
                                ) : (
                                  <span style={{ color: '#aaa' }}>+ Пусто</span>
                                )}
                              </div>
                            );
                          })}

                          <div style={{
                            gridColumn: `1 / span ${selectedFloor.width || 8}`,
                            height: '35px',
                            backgroundColor: '#e9ecef',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6c757d',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            letterSpacing: '2px',
                          }}>
                            ═══ КОРИДОР ═══
                          </div>

                          {Array.from({ length: selectedFloor.width || 8 }).map((_, x) => {
                            const room = rooms.find((r) => r.x_pos === x && r.y_pos === 2);
                            return (
                              <div
                                key={`bot-${x}`}
                                onClick={() => handleCellClick(x, 2)}
                                style={{
                                  height: '70px',
                                  border: '2px dashed #bbb',
                                  borderRadius: '6px',
                                  backgroundColor: room ? (room.is_technical ? '#e2e3e5' : '#d1e7dd') : '#fff',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '2px',
                                  textAlign: 'center',
                                }}
                              >
                                {room ? (
                                  <>
                                    <strong>{room.room_number}</strong>
                                    <span>{room.is_technical ? 'Техническая' : `${room.capacity} мест`}</span>
                                  </>
                                ) : (
                                  <span style={{ color: '#aaa' }}>+ Пусто</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {selectedRoom && (
                        <div style={{ marginTop: '20px', backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ccc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h5>Редактирование комнаты ({selectedRoom.x_pos + 1} колонка, {selectedRoom.y_pos === 0 ? 'Верх' : 'Низ'})</h5>
                            <button onClick={() => setSelectedRoom(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                          </div>

                          <form onSubmit={handleSaveRoom} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="input-group">
                              <label>Номер комнаты</label>
                              <input
                                type="text"
                                value={selectedRoom.room_number}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, room_number: e.target.value })}
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>Название комнаты</label>
                              <input
                                type="text"
                                value={selectedRoom.name || ''}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, name: e.target.value })}
                              />
                            </div>

                            <div className="input-group">
                              <label>Вместимость (мест)</label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={selectedRoom.capacity}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, capacity: Number(e.target.value) })}
                              />
                            </div>

                            <div className="input-group">
                              <label>Переопределить пол комнаты</label>
                              <select
                                value={selectedRoom.gender || 'DEFAULT'}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, gender: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                <option value="DEFAULT">По умолчанию от корпуса/этажа</option>
                                <option value="M">Мужской</option>
                                <option value="F">Женский</option>
                              </select>
                            </div>

                            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                id="is_tech"
                                checked={!!selectedRoom.is_technical}
                                onChange={(e) => setSelectedRoom({ ...selectedRoom, is_technical: e.target.checked ? 1 : 0 })}
                              />
                              <label htmlFor="is_tech">Заблокирована (Техническое помещение)</label>
                            </div>

                            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                              <button type="submit" className="btn btn-primary" disabled={savingRoom}>
                                {savingRoom ? 'Сохранение...' : 'Сохранить параметры комнаты'}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#888' }}>Выберите или создайте корпус слева.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};