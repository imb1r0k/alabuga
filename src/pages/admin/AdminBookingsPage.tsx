import React, { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { getAdminBookings, updateAdminBooking, getAllRooms, getSettings, updateSettings, runAutoApproveBookings } from '../../services/api';
import { X, Search, CopyCheck, ChevronLeft, ChevronRight, SlidersHorizontal, Bot } from 'lucide-react';

const ITEMS_PER_PAGE = 15;

export const AdminBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [allAvailableRooms, setAllAvailableRooms] = useState<any[]>([]);
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingMsg, setBookingMsg] = useState('');
  const { showToast } = useToast();

  // Автоодобрение ботом
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);

  // Поиск
  const [searchTerm, setSearchTerm] = useState('');

  // Фильтры отображения статусов (сохранение в localStorage)
  const [showRejected, setShowRejected] = useState(() => {
    return localStorage.getItem('admin_booking_show_rejected') === 'true';
  });
  const [showArchived, setShowArchived] = useState(() => {
    return localStorage.getItem('admin_booking_show_archived') === 'true';
  });
  const [showRecalled, setShowRecalled] = useState(() => {
    return localStorage.getItem('admin_booking_show_recalled') === 'true';
  });

  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    localStorage.setItem('admin_booking_show_rejected', String(showRejected));
  }, [showRejected]);

  useEffect(() => {
    localStorage.setItem('admin_booking_show_archived', String(showArchived));
  }, [showArchived]);

  useEffect(() => {
    localStorage.setItem('admin_booking_show_recalled', String(showRecalled));
  }, [showRecalled]);

  useEffect(() => {
    loadBookings();
    loadAutoApproveSetting();
  }, []);

  const loadAutoApproveSetting = async () => {
    try {
      const settings = await getSettings();
      setAutoApproveEnabled(settings['auto-accept-bookings'] === '1' || settings['auto-accept-bookings'] === 'true');
    } catch (err) {
      console.error(err);
    }
  };

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

  // Интервал автоодобрения ботом раз в 10 секунд если функция включена
  useEffect(() => {
    if (!autoApproveEnabled) return;

    const interval = setInterval(async () => {
      try {
        const res = await runAutoApproveBookings();
        if (res.approved_count > 0) {
          showToast(`Бот автоматически одобрил заявок: ${res.approved_count}`, 'success');
          loadBookings();
        }
      } catch (err) {
        console.error('Ошибка фонового автоодобрения:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [autoApproveEnabled]);

  const handleToggleAutoApprove = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoApproveEnabled(val);
    try {
      await updateSettings({ 'auto-accept-bookings': val ? '1' : '0' });
      showToast(`Автоодобрение ботом ${val ? 'включено' : 'выключено'}`, 'info');
      if (val) {
        const res = await runAutoApproveBookings();
        if (res.approved_count > 0) {
          showToast(`Бот автоматически одобрил заявок: ${res.approved_count}`, 'success');
          loadBookings();
        }
      }
    } catch (err: any) {
      showToast('Ошибка сохранения настройки: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // ─── Определение дубликатов (только среди АКТИВНЫХ заявок) ─────────────────
  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    const dupes = new Set<number>();

    // Учитываем только заявки со статусами pending, approved, approved_bot (игнорируем recalled, rejected, archived)
    const activeBookings = bookings.filter((b) => ['pending', 'approved', 'approved_bot'].includes(b.status));

    activeBookings.forEach((b) => {
      const key = `${(b.last_name || '').trim().toLowerCase()}_${(b.patronymic || b.first_name || '').trim().toLowerCase()}`;
      if (key !== '_') {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    activeBookings.forEach((b) => {
      const key = `${(b.last_name || '').trim().toLowerCase()}_${(b.patronymic || b.first_name || '').trim().toLowerCase()}`;
      if (key !== '_' && (counts.get(key) || 0) > 1) {
        dupes.add(b.id);
      }
    });

    return dupes;
  }, [bookings]);

  // ─── Поиск и фильтрация ─────────────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    let result = [...bookings];

    // Исключение статусов по переключателям
    result = result.filter((b) => {
      if (b.status === 'rejected' && !showRejected) return false;
      if (b.status === 'archived' && !showArchived) return false;
      if (b.status === 'recalled' && !showRecalled) return false;
      return true;
    });

    // Фильтрация по поиску
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((b) => {
        const fullName = `${b.last_name || ''} ${b.first_name || ''} ${b.patronymic || ''}`.toLowerCase();
        const phone = (b.user_phone || '').toLowerCase();
        const login = (b.login || '').toLowerCase();
        const building = (b.building_name || '').toLowerCase();
        const room = String(b.room_number || '').toLowerCase();
        const team = (b.team_name || '').toLowerCase();

        return (
          fullName.includes(q) ||
          phone.includes(q) ||
          login.includes(q) ||
          building.includes(q) ||
          room.includes(q) ||
          team.includes(q)
        );
      });
    }

    // Сортировка: "Ожидает" (pending) всегда сверху
    result.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.id - a.id;
    });

    return result;
  }, [bookings, searchTerm, showRejected, showArchived, showRecalled]);

  // Сброс страницы при поиске/фильтрации
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showRejected, showArchived, showRecalled]);

  // Пагинированный список
  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE) || 1;
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBookings, currentPage]);

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

  const handleQuickStatusChange = async (booking: any, newStatus: string) => {
    try {
      await updateAdminBooking({ id: booking.id, room_id: booking.room_id, status: newStatus, comment: booking.comment });
      showToast('Статус обновлен', 'success');
      loadBookings();
    } catch (err: any) {
      showToast('Ошибка обновления статуса: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'approved') return { label: 'Одобрено', bg: '#16a34a' };
    if (status === 'approved_bot') return { label: 'Одобрено ботом', bg: '#0891b2' };
    if (status === 'rejected') return { label: 'Отклонено', bg: '#dc2626' };
    if (status === 'recalled') return { label: 'Отозвано', bg: '#475569' };
    if (status === 'archived') return { label: 'В архиве', bg: '#64748b' };
    return { label: 'Ожидает', bg: '#eab308' };
  };

  return (
    <AdminLayout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Управление бронированиями</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Всего записей: {filteredBookings.length}
            </p>
          </div>

          {/* Поиск */}
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Поиск (ФИО, тел, логин, комната)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Настройки отображения статусов и автоодобрения */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '13px' }}>
          <span style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SlidersHorizontal size={16} color="#0284c7" />
            Отображение:
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569' }}>
            <input
              type="checkbox"
              checked={showRejected}
              onChange={(e) => setShowRejected(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Показывать «Отклонено»
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569' }}>
            <input
              type="checkbox"
              checked={showRecalled}
              onChange={(e) => setShowRecalled(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Показывать «Отозвано»
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Показывать «В архиве»
          </label>

          {/* Переключатель Автоодобрения ботом */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: autoApproveEnabled ? '#ecfeff' : '#f8fafc', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${autoApproveEnabled ? '#a5f3fc' : '#e2e8f0'}` }}>
            <Bot size={18} color={autoApproveEnabled ? '#0891b2' : '#64748b'} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: autoApproveEnabled ? '#0e7490' : '#475569' }}>
              <input
                type="checkbox"
                checked={autoApproveEnabled}
                onChange={handleToggleAutoApprove}
                style={{ width: '16px', height: '16px' }}
              />
              Автобронирование вкл.
            </label>
          </div>
        </div>

        {bookingsLoading ? (
          <Skeleton width="100%" height={250} />
        ) : (
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px' }}>#</th>
                    <th style={{ padding: '10px' }}>Дата</th>
                    <th style={{ padding: '10px' }}>ФИО</th>
                    <th style={{ padding: '10px' }}>Тел. / Логин</th>
                    <th style={{ padding: '10px' }}>Корпус</th>
                    <th style={{ padding: '10px' }}>Этаж</th>
                    <th style={{ padding: '10px' }}>Комната</th>
                    <th style={{ padding: '10px' }}>Статус</th>
                    <th style={{ padding: '10px' }}>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Заявки не найдены
                      </td>
                    </tr>
                  ) : (
                    paginatedBookings.map((b) => {
                      const isDuplicate = duplicateIds.has(b.id);
                      const sInfo = getStatusBadge(b.status);

                      return (
                        <tr
                          key={b.id}
                          onClick={() => handleSelectBooking(b)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            backgroundColor: selectedBooking?.id === b.id ? '#e0f2fe' : isDuplicate ? '#fff7ed' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px' }}>#{b.id}</td>
                          <td style={{ padding: '10px' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{b.last_name} {b.first_name || b.user_name} {b.patronymic || ''}</span>
                              {isDuplicate && (
                                <span
                                  title="Обнаружен дубликат ФИО среди активных заявок!"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    backgroundColor: '#ffedd5',
                                    color: '#c2410c',
                                    border: '1px solid #fed7aa',
                                    borderRadius: '4px',
                                    padding: '1px 6px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  <CopyCheck size={12} /> Дубликат
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <div>{b.user_phone || '-'}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>@{b.login}</div>
                          </td>
                          <td style={{ padding: '10px' }}>{b.building_name}</td>
                          <td style={{ padding: '10px' }}>{b.floor_number}</td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>№{b.room_number}</td>
                          <td style={{ padding: '10px' }}>
                            <select
                              value={b.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleQuickStatusChange(b, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#fff',
                                backgroundColor: sInfo.bg,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="pending" style={{ backgroundColor: '#fff', color: '#000' }}>Ожидает</option>
                              <option value="approved" style={{ backgroundColor: '#fff', color: '#000' }}>Одобрено</option>
                              <option value="approved_bot" style={{ backgroundColor: '#fff', color: '#000' }}>Одобрено ботом</option>
                              <option value="rejected" style={{ backgroundColor: '#fff', color: '#000' }}>Отклонено</option>
                              <option value="recalled" style={{ backgroundColor: '#fff', color: '#000' }}>Отозвано</option>
                              <option value="archived" style={{ backgroundColor: '#fff', color: '#000' }}>В архиве</option>
                            </select>
                          </td>
                          <td style={{ padding: '10px' }}>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <button
                  className="btn btn-secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                >
                  <ChevronLeft size={16} /> Назад
                </button>

                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                  Страница {currentPage} из {totalPages}
                </span>

                <button
                  className="btn btn-secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                >
                  Вперед <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* МОДАЛЬНОЕ ОКНО УПРАВЛЕНИЯ БРОНИРОВАНИЕМ (ЦЕНТРИРОВАННЫЙ ОВЕРЛЕЙ) */}
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
                  maxWidth: '560px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                  position: 'relative',
                  padding: '24px',
                }}>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={20} />
                  </button>

                  <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: '#0f172a' }}>
                    Управление бронированием #{selectedBooking.id}
                  </h3>

                  {bookingMsg && (
                    <div style={{ padding: '8px', borderRadius: '4px', marginBottom: '12px', backgroundColor: bookingMsg.includes('Ошибка') ? '#f8d7da' : '#d4edda', fontSize: '14px' }}>
                      {bookingMsg}
                    </div>
                  )}

                  <form onSubmit={handleSaveBooking} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="input-group">
                      <label>Фамилия</label>
                      <input
                        type="text"
                        value={selectedBooking.last_name || ''}
                        onChange={(e) => setSelectedBooking({ ...selectedBooking, last_name: e.target.value })}
                      />
                    </div>

                    <div className="input-group">
                      <label>Имя</label>
                      <input
                        type="text"
                        value={selectedBooking.first_name || ''}
                        onChange={(e) => setSelectedBooking({ ...selectedBooking, first_name: e.target.value })}
                      />
                    </div>

                    <div className="input-group">
                      <label>Отчество</label>
                      <input
                        type="text"
                        value={selectedBooking.patronymic || ''}
                        onChange={(e) => setSelectedBooking({ ...selectedBooking, patronymic: e.target.value })}
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

                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Выберите комнату из базы</label>
                      <select
                        value={selectedBooking.room_id}
                        onChange={(e) => setSelectedBooking({ ...selectedBooking, room_id: Number(e.target.value) })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        {allAvailableRooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.building_name} — Этаж {r.floor_number} — Комната {r.room_number} ({r.name || 'Без названия'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Статус бронирования</label>
                      <select
                        value={selectedBooking.status}
                        onChange={(e) => setSelectedBooking({ ...selectedBooking, status: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="pending">Ожидает</option>
                        <option value="approved">Одобрено</option>
                        <option value="approved_bot">Одобрено ботом</option>
                        <option value="rejected">Отклонено</option>
                        <option value="recalled">Отозвано</option>
                        <option value="archived">В архиве</option>
                      </select>
                    </div>

                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Комментарий (при отклонении/отзыве)</label>
                      <textarea
                        value={selectedBooking.comment || ''}
                        onChange={(e) => setSelectedBooking({ ...selectedBooking, comment: e.target.value })}
                        rows={3}
                        placeholder="Причина или заметка"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button type="submit" className="btn btn-primary flex-1" disabled={savingBooking}>
                        {savingBooking ? 'Сохранение...' : 'Сохранить изменения'}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedBooking(null)}>
                        Закрыть
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