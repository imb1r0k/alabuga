import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { getAdminBookings, updateAdminBooking, getAllRooms } from '../../services/api';
import { X } from 'lucide-react';

export const AdminBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [allAvailableRooms, setAllAvailableRooms] = useState<any[]>([]);
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingMsg, setBookingMsg] = useState('');
  const { showToast } = useToast();

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
      showToast('Бронирование успешно обновлено', 'success');
      loadBookings();
    } catch (err: any) {
      const errorText = 'Ошибка: ' + (err.response?.data?.error || err.message);
      setBookingMsg(errorText);
      showToast(errorText, 'error');
    } finally {
      setSavingBooking(false);
    }
  };

  // Быстрая смена статуса прямо в таблице
  const handleQuickStatusChange = async (booking: any, newStatus: string) => {
    try {
      await updateAdminBooking({ id: booking.id, room_id: booking.room_id, status: newStatus, comment: booking.comment });
      showToast('Статус обновлен', 'success');
      loadBookings();
    } catch (err: any) {
      showToast('Ошибка обновления статуса: ' + (err.response?.data?.error || err.message), 'error');
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
                    <th style={{ padding: '8px' }}>Действие</th>
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
                        <select
                          value={b.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleQuickStatusChange(b, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '4px', borderRadius: '4px', fontSize: '13px' }}
                        >
                          <option value="pending">Ожидает</option>
                          <option value="approved">Одобрено</option>
                          <option value="approved_bot">Одобрено ботом</option>
                          <option value="rejected">Отклонено</option>
                          <option value="archived">В архиве</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectBooking(b);
                          }}
                        >
                          Управление
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Модальное окно управления бронированием */}
            {selectedBooking && (
              <div style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '16px',
              }}>
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  maxWidth: '600px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                  position: 'relative',
                  padding: '24px',
                }}>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
                  >
                    <X size={20} />
                  </button>

                  <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Управление бронированием #{selectedBooking.id}</h3>

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
                        <option value="archived">В архиве</option>
                      </select>
                    </div>

                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Комментарий (при отклонении)</label>
                      <textarea
                        value={selectedBooking.comment || ''}
                        onChange={(e) => setSelectedBooking({ ...selectedBooking, comment: e.target.value })}
                        rows={3}
                        placeholder="Причина отклонения, заметка для пользователя"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                      <button type="submit" className="btn btn-primary" disabled={savingBooking}>
                        {savingBooking ? 'Сохранение...' : 'Сохранить изменения бронирования'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};