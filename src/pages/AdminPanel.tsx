import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Skeleton } from '../components/Skeleton<dyad-write path="src/pages/AdminPanel.tsx" description="Полный код административной панели со всеми вкладками (Главная, Пользователи, Бронирования, Конструктор корпусов)">
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Skeleton } from '../components/Skeleton';
import {
  getAdminUsers,
  updateAdminUser,
  getUserDetails,
  getAdminBookings,
  updateAdminBooking,
  getAdminBuildings,
  saveAdminBuilding,
  getAdminFloors,
  saveAdminFloor,
  getAdminRooms,
  saveAdminRoom,
  getAllRooms,
} from '../services/api';

export const AdminPanel = () => {
  const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { siteTitle, loading: settingsLoading, updateSiteTitle } = useSettings();

  const [activeTab, setActiveTab] = useState<'home' | 'users' | 'bookings' | 'buildings'>('home');

  // ----- СОСТОЯНИЕ: ГЛАВНАЯ (Настройки) -----
  const [titleInput, setTitleInput] = useState(siteTitle);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleMsg, setTitleMsg] = useState('');

  // ----- СОСТОЯНИЕ: ПОЛЬЗОВАТЕЛИ -----
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userFormData, setUserFormData] = useState<any>({});
  const [userDetails, setUserDetails] = useState<any>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userMsg, setUserMsg] = useState('');

  // ----- СОСТОЯНИЕ: БРОНИРОВАНИЯ -----
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [allAvailableRooms, setAllAvailableRooms] = useState<any[]>([]);
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingMsg, setBookingMsg] = useState('');

  // ----- СОСТОЯНИЕ: КОРПУСА -----
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
    setTitleInput(siteTitle);
  }, [siteTitle]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'bookings') loadBookings();
    if (activeTab === 'buildings') loadBuildings();
  }, [activeTab]);

  // Загрузка пользователей
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Выбор пользователя для редактирования
  const handleSelectUser = async (u: any) => {
    setSelectedUser(u);
    setUserFormData({
      id: u.id,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      email: u.email || '',
      role: u.role || 'user',
      team_name: u.team_name || '',
      password: '',
    });
    setUserMsg('');
    try {
      const details = await getUserDetails(u.id);
      setUserDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    setUserMsg('');
    try {
      await updateAdminUser(userFormData);
      setUserMsg('Данные пользователя успешно сохранены');
      loadUsers();
    } catch (err: any) {
      setUserMsg('Ошибка: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingUser(false);
    }
  };

  // Загрузка бронирований
  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const [bData, rData] = await Promise.all([getAdminBookings(), getAllRooms()]);
      setBookings(bData);
      setAllAvailableRooms(rData);
    } catch (err) {
      console.error(err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleSelectBooking = (b: any) => {
    setSelectedBooking({ ...b });
    setBookingMsg('');
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBooking(true);
    setBookingMsg('');
    try {
      await updateAdminBooking(selectedBooking);
      setBookingMsg('Бронирование обновлено');
      loadBookings();
    } catch (err: any) {
      setBookingMsg('Ошибка: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingBooking(false);
    }
  };

  // Загрузка корпусов
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

  // Автогенератор этажа (создание комнат в 3 строки: верх, коридор, низ)
  const handleGenerateFloorLayout = async () => {
    if (!selectedFloor || !selectedBuilding) return;
    const width = selectedFloor.width || 8;
    try {
      // Генерируем комнаты для верхней ряда (y=0) и нижнего ряда (y=2)
      for (let x = 0; x < width; x++) {
        // Верхний ряд
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

        // Нижний ряд
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
    if (y === 1) return; // Коридор не редактируется
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

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>Требуется авторизация</h2>
          <p style={{ color: '#666', textAlign: 'center' }}>Для доступа к админ-панели необходимо войти в систему.</p>
        </div>
      </div>
    );
  }

  if (authLoading || settingsLoading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="card" style={{ minHeight: '400px' }}>
          <Skeleton width="100%" height={40} className="mb-4" />
          <Skeleton width="100%" height={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '30px', paddingBottom: '50px' }}>
      <div className="card">
        <h1 style={{ fontSize: '26px', marginBottom: '20px', color: '#333' }}>Панель администратора</h1>

        {/* Навигация по вкладкам */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #eee', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('home')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'home' ? '3px solid #007bff' : '3px solid transparent',
              backgroundColor: 'transparent',
              fontWeight: activeTab === 'home' ? 'bold' : 'normal',
              color: activeTab === 'home' ? '#007bff' : '#555',
              cursor: 'pointer',
            }}
          >
            Главная
          </button>

          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid #007bff' : '3px solid transparent',
              backgroundColor: 'transparent',
              fontWeight: activeTab === 'users' ? 'bold' : 'normal',
              color: activeTab === 'users' ? '#007bff' : '#555',
              cursor: 'pointer',
            }}
          >
            Пользователи
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'bookings' ? '3px solid #007bff' : '3px solid transparent',
              backgroundColor: 'transparent',
              fontWeight: activeTab === 'bookings' ? 'bold' : 'normal',
              color: activeTab === 'bookings' ? '#007bff' : '#555',
              cursor: 'pointer',
            }}
          >
            Бронирования
          </button>

          <button
            onClick={() => setActiveTab('buildings')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'buildings' ? '3px solid #007bff' : '3px solid transparent',
              backgroundColor: 'transparent',
              fontWeight: activeTab === 'buildings' ? 'bold' : 'normal',
              color: activeTab === 'buildings' ? '#007bff' : '#555',
              cursor: 'pointer',
            }}
          >
            Корпуса
          </button>
        </div>

        {/* ----------------- ВКЛАДКА 1: ГЛАВНАЯ ----------------- */}
        {activeTab === 'home' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Основные настройки портала</h3>
            {titleMsg && (
              <div style={{ padding: '10px', borderRadius: '4px', marginBottom: '15px', backgroundColor: titleMsg.includes('Ошибка') ? '#f8d7da' : '#d4edda' }}>
                {titleMsg}
              </div>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSavingTitle(true);
              setTitleMsg('');
              try {
                await updateSiteTitle(titleInput);
                setTitleMsg('Название сайта успешно обновлено!');
              } catch (err: any) {
                setTitleMsg('Ошибка: ' + (err.response?.data?.error || err.message));
              } finally {
                setSavingTitle(false);
              }
            }}>
              <div className="input-group">
                <label>Название сайта (хранится в базе данных)</label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  required
                  disabled={savingTitle}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingTitle}>
                {savingTitle ? 'Сохранение...' : 'Сохранить название'}
              </button>
            </form>
          </div>
        )}

        {/* ----------------- ВКЛАДКА 2: ПОЛЬЗОВАТЕЛИ ----------------- */}
        {activeTab === 'users' && (
          <div>
            {usersLoading ? (
              <Skeleton width="100%" height={250} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 1fr' : '1fr', gap: '20px' }}>
                <div>
                  <h3 style={{ marginBottom: '12px' }}>Список пользователей</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: '8px' }}>Фамилия</th>
                          <th style={{ padding: '8px' }}>Имя</th>
                          <th style={{ padding: '8px' }}>Телефон</th>
                          <th style={{ padding: '8px' }}>Логин (Email)</th>
                          <th style={{ padding: '8px' }}>Роль</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            style={{
                              borderBottom: '1px solid #eee',
                              cursor: 'pointer',
                              backgroundColor: selectedUser?.id === u.id ? '#e9ecef' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '8px' }}>{u.last_name || '-'}</td>
                            <td style={{ padding: '8px' }}>{u.first_name || u.name}</td>
                            <td style={{ padding: '8px' }}>{u.phone || '-'}</td>
                            <td style={{ padding: '8px' }}>{u.email}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: u.role === 'admin' ? '#dc3545' : '#6c757d',
                                color: '#fff',
                                fontSize: '12px'
                              }}>
                                {u.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Редактирование выбранного пользователя */}
                {selectedUser && (
                  <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3>Редактирование #{selectedUser.id}</h3>
                      <button onClick={() => setSelectedUser(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                    </div>

                    {userMsg && (
                      <div style={{ padding: '8px', borderRadius: '4px', marginBottom: '12px', backgroundColor: userMsg.includes('Ошибка') ? '#f8d7da' : '#d4edda', fontSize: '14px' }}>
                        {userMsg}
                      </div>
                    )}

                    <form onSubmit={handleSaveUser}>
                      <div className="input-group">
                        <label>Фамилия</label>
                        <input
                          type="text"
                          value={userFormData.last_name}
                          onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label>Имя</label>
                        <input
                          type="text"
                          value={userFormData.first_name}
                          onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label>Телефон</label>
                        <input
                          type="text"
                          value={userFormData.phone}
                          onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label>Email (Логин)</label>
                        <input
                          type="email"
                          value={userFormData.email}
                          onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label>Новый пароль (оставьте пустым если не хотите менять)</label>
                        <input
                          type="password"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label>Роль</label>
                        <select
                          value={userFormData.role}
                          onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                          <option value="user">Пользователь</option>
                          <option value="moderator">Модератор</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label>Команда</label>
                        <input
                          type="text"
                          value={userFormData.team_name}
                          onChange={(e) => setUserFormData({ ...userFormData, team_name: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={savingUser} style={{ width: '100%', marginTop: '10px' }}>
                        {savingUser ? 'Сохранение...' : 'Сохранить пользователя'}
                      </button>
                    </form>

                    {/* История бронирований и текущее бронирование */}
                    {userDetails && (
                      <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                        <h4>Текущее бронирование</h4>
                        {userDetails.current_booking ? (
                          <p style={{ fontSize: '14px', color: '#333' }}>
                            {userDetails.current_booking.building_name}, Этаж {userDetails.current_booking.floor_number}, Комната {userDetails.current_booking.room_number} ({userDetails.current_booking.status})
                          </p>
                        ) : (
                          <p style={{ fontSize: '14px', color: '#888' }}>Нет активных бронирований</p>
                        )}

                        <h4 style={{ marginTop: '12px' }}>История бронирований</h4>
                        {userDetails.bookings_history?.length > 0 ? (
                          <ul style={{ paddingLeft: '20px', fontSize: '13px' }}>
                            {userDetails.bookings_history.map((bh: any) => (
                              <li key={bh.id}>
                                #{bh.id} - {bh.building_name}, комн. {bh.room_number} [{bh.status}] ({new Date(bh.created_at).toLocaleDateString()})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontSize: '13px', color: '#888' }}>История пуста</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ----------------- ВКЛАДКА 3: БРОНИРОВАНИЯ ----------------- */}
        {activeTab === 'bookings' && (
          <div>
            {bookingsLoading ? (
              <Skeleton width="100%" height={250} />
            ) : (
              <div>
                <h3 style={{ marginBottom: '16px' }}>Список всех бронирований</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '8px' }}>#</th>
                        <th style={{ padding: '8px' }}>Дата</th>
                        <th style={{ padding: '8px' }}>ФИО</th>
                        <th style={{ padding: '8px' }}>Корпус</th>
                        <th style={{ padding: '8px' }}>Этаж</th>
                        <th style={{ padding: '8px' }}>Комната</th>
                        <th style={{ padding: '8px' }}>Пол</th>
                        <th style={{ padding: '8px' }}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => handleSelectBooking(b)}
                          style={{
                            borderBottom: '1px solid #eee',
                            cursor: 'pointer',
                            backgroundColor: selectedBooking?.id === b.id ? '#e9ecef' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px' }}>#{b.id}</td>
                          <td style={{ padding: '8px' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '8px' }}>{b.last_name} {b.first_name || b.user_name}</td>
                          <td style={{ padding: '8px' }}>{b.building_name}</td>
                          <td style={{ padding: '8px' }}>{b.floor_number}</td>
                          <td style={{ padding: '8px' }}>{b.room_number}</td>
                          <td style={{ padding: '8px' }}>{b.gender === 'M' ? 'М' : 'Ж'}</td>
                          <td style={{ padding: '8px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#fff',
                              backgroundColor:
                                b.status === 'approved' ? '#28a745' :
                                b.status === 'approved_bot' ? '#17a2b8' :
                                b.status === 'rejected' ? '#dc3545' : '#ffc107',
                            }}>
                              {
                                b.status === 'approved' ? 'Одобрено' :
                                b.status === 'approved_bot' ? 'Одобрено ботом' :
                                b.status === 'rejected' ? 'Отклонено' : 'Ожидает'
                              }
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Редактирование выбранного бронирования */}
                {selectedBooking && (
                  <div style={{ marginTop: '24px', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3>Редактирование бронирования #{selectedBooking.id}</h3>
                      <button onClick={() => setSelectedBooking(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                    </div>

                    {bookingMsg && (
                      <div style={{ padding: '8px', borderRadius: '4px', marginBottom: '12px', backgroundColor: bookingMsg.includes('Ошибка') ? '#f8d7da' : '#d4edda', fontSize: '14px' }}>
                        {bookingMsg}
                      </div>
                    )}

                    <form onSubmit={handleSaveBooking} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="input-group">
                        <label>Имя пользователя</label>
                        <input
                          type="text"
                          value={selectedBooking.first_name || ''}
                          onChange={(e) => setSelectedBooking({ ...selectedBooking, first_name: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label>Фамилия пользователя</label>
                        <input
                          type="text"
                          value={selectedBooking.last_name || ''}
                          onChange={(e) => setSelectedBooking({ ...selectedBooking, last_name: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label>Телефон</label>
                        <input
                          type="text"
                          value={selectedBooking.user_phone || ''}
                          onChange={(e) => setSelectedBooking({ ...selectedBooking, user_phone: e.target.value })}
                        />
                      </div>

                      <div className="input-group">
                        <label>Выберите комнату из базы</label>
                        <select
                          value={selectedBooking.room_id}
                          onChange={(e) => setSelectedBooking({ ...selectedBooking, room_id: Number(e.target.value) })}
                          style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                          {allAvailableRooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.building_name} — Этаж {r.floor_number} — Комната {r.room_number} ({r.name || 'Без названия'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group">
                        <label>Статус бронирования</label>
                        <select
                          value={selectedBooking.status}
                          onChange={(e) => setSelectedBooking({ ...selectedBooking, status: e.target.value })}
                          style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                          <option value="pending">Ожидает</option>
                          <option value="approved">Одобрено</option>
                          <option value="approved_bot">Одобрено ботом</option>
                          <option value="rejected">Отклонено</option>
                        </select>
                      </div>

                      <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                        <button type="submit" className="btn btn-primary" disabled={savingBooking}>
                          {savingBooking ? 'Сохранение...' : 'Сохранить изменения бронирования'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ----------------- ВКЛАДКА 4: КОРПУСА (КОНСТРУКТОР) ----------------- */}
        {activeTab === 'buildings' && (
          <div>
            {buildingsLoading ? (
              <Skeleton width="100%" height={250} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
                {/* Правая/Левая панель: Список корпусов */}
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

                  {/* Форма создания корпуса */}
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

                {/* Редактирование выбранного корпуса и этажей */}
                <div>
                  {selectedBuilding ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>Макет: {selectedBuilding.name}</h3>
                        <button onClick={handleAddFloor} className="btn btn-secondary" style={{ fontSize: '13px' }}>
                          + Добавить этаж
                        </button>
                      </div>

                      {/* Селектор этажей */}
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
                          {/* Панель настройки этажа */}
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

                          {/* Конструктор / Макет этажа (3 строки по высоте) */}
                          <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${selectedFloor.width || 8}, 80px)`,
                              gap: '6px',
                              justifyContent: 'start',
                            }}>
                              {/* Ряд 0: Верхние комнаты */}
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

                              {/* Ряд 1: Коридор по центру */}
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

                              {/* Ряд 2: Нижние комнаты */}
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

                          {/* Модальная форма / Секция редактирования комнаты */}
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
        )}
      </div>
    </div>
  );
};