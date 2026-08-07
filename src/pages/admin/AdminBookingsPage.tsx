import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { getAdminBookings, updateAdminBooking, getAllRooms } from '../../services/api';

export const AdminBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [allAvailableRooms, setAllAvailableRooms] = useState<any[]>([]);
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingMsg, setBookingMsg] = useState('');

  useEffect(() => {
    loadBookings();
  }, []);

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

  return (
    <AdminLayout>
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
    </AdminLayout>
  );
};