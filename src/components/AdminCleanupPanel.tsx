import React, { useState } from 'react';
import { FileDown, Archive, Users, Download, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';
import { getExportBookings, getExportLayouts, archiveAllBookings, archiveAllUsers } from '../services/api';

export const AdminCleanupPanel: React.FC = () => {
  const { showToast } = useToast();
  const [exportingBookings, setExportingBookings] = useState(false);
  const [exportingLayouts, setExportingLayouts] = useState(false);
  const [archivingBookings, setArchivingBookings] = useState(false);
  const [archivingUsers, setArchivingUsers] = useState(false);
  const [confirmArchiveBookings, setConfirmArchiveBookings] = useState(false);
  const [confirmArchiveUsers, setConfirmArchiveUsers] = useState(false);

  // ─── Экспорт бронирований в Excel ────────────────────────────────────────

  const handleExportBookings = async () => {
    setExportingBookings(true);
    try {
      const bookings = await getExportBookings();

      // Маппинг статусов
      const statusMap: Record<string, string> = {
        pending: 'Ожидает',
        approved: 'Одобрено',
        approved_bot: 'Одобрено ботом',
        rejected: 'Отклонено',
        archived: 'В архиве',
      };

      const rows = bookings.map((b: any, index: number) => ({
        '№': index + 1,
        'ID бронирования': b.id,
        'Дата создания': b.created_at,
        'Фамилия': b.last_name || '',
        'Имя': b.first_name || '',
        'Телефон': b.user_phone || '',
        'Логин': b.login || '',
        'Корпус': b.building_name || '',
        'Этаж': b.floor_number || '',
        'Комната': b.room_number || '',
        'Вместимость': b.capacity || '',
        'Пол комнаты': b.gender || '',
        'Статус': statusMap[b.status] || b.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Бронирования');

      // Автоширина колонок
      const maxColWidth = 20;
      worksheet['!cols'] = Object.keys(rows[0] || {}).map((key) => ({
        wch: Math.min(Math.max(key.length * 2, 12), maxColWidth),
      }));

      XLSX.writeFile(workbook, `bookings_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`Экспортировано бронирований: ${bookings.length}`, 'success');
    } catch (err: any) {
      showToast('Ошибка экспорта: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setExportingBookings(false);
    }
  };

  // ─── Экспорт макетов всех корпусов ───────────────────────────────────────

  const handleExportLayouts = async () => {
    setExportingLayouts(true);
    try {
      const buildings = await getExportLayouts();

      // Создаём отдельный лист с описанием, и по листу на каждое здание
      const workbook = XLSX.utils.book_new();

      // Лист-индекс
      const indexRows = buildings.map((b: any, bi: number) => ({
        '№': bi + 1,
        'ID': b.id,
        'Название': b.name,
        'Пол': b.gender,
        'Этажей': b.floors.length,
      }));

      const indexSheet = XLSX.utils.json_to_sheet(indexRows);
      XLSX.utils.book_append_sheet(workbook, indexSheet, 'Корпуса');
      indexSheet['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 10 }, { wch: 10 }];

      buildings.forEach((b: any) => {
        const rows: any[] = [];
        b.floors.forEach((f: any) => {
          f.rooms.forEach((r: any) => {
            rows.push({
              'Корпус': b.name,
              'Этаж': f.floor_number,
              'Комната': r.room_number,
              'Название': r.name || '',
              'Тип': r.room_type,
              'Вместимость': r.capacity,
              'Пол': r.gender,
              'X': r.x_pos,
              'Y': r.y_pos,
            });
          });
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const sheetName = (b.name || `Корпус ${b.id}`).slice(0, 31); // ограничение Excel
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
        ws['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 6 }];
      });

      XLSX.writeFile(workbook, `layouts_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`Экспортировано макетов корпусов: ${buildings.length}`, 'success');
    } catch (err: any) {
      showToast('Ошибка экспорта: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setExportingLayouts(false);
    }
  };

  // ─── Архивация всех бронирований ─────────────────────────────────────────

  const handleArchiveBookings = async () => {
    setArchivingBookings(true);
    try {
      const result = await archiveAllBookings();
      showToast(`Все бронирования перемещены в архив (${result.affected} шт.)`, 'success');
      setConfirmArchiveBookings(false);
    } catch (err: any) {
      showToast('Ошибка архивации: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setArchivingBookings(false);
    }
  };

  // ─── Архивация всех пользователей (кроме админов) ─────────────────────────

  const handleArchiveUsers = async () => {
    setArchivingUsers(true);
    try {
      const result = await archiveAllUsers();
      showToast(`Пользователи перемещены в архив (${result.affected} чел.)`, 'success');
      setConfirmArchiveUsers(false);
    } catch (err: any) {
      showToast('Ошибка архивации: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setArchivingUsers(false);
    }
  };

  // ─── UI ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Экспорт */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={18} color="#0284c7" />
          Экспорт данных
        </h4>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Выгрузка данных в формате Excel (.xlsx)</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleExportBookings}
            disabled={exportingBookings}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          >
            <FileDown size={16} />
            {exportingBookings ? 'Экспорт...' : 'Экспорт бронирований'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportLayouts}
            disabled={exportingLayouts}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          >
            <FileDown size={16} />
            {exportingLayouts ? 'Экспорт...' : 'Экспорт макетов корпусов'}
          </button>
        </div>
      </div>

      {/* Очистка */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trash2 size={18} color="#ef4444" />
          Очистка системы
        </h4>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Внимание! Эти действия необратимы и затронут большое количество данных.
        </p>

        {/* Архивация бронирований */}
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Archive size={16} color="#dc2626" />
                Архивация всех бронирований
              </strong>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                Все текущие бронирования получат статус «archived» и будут скрыты из основной статистики.
              </p>
            </div>
            {!confirmArchiveBookings ? (
              <button
                className="btn btn-danger"
                onClick={() => setConfirmArchiveBookings(true)}
                disabled={archivingBookings}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
              >
                <Archive size={16} />
                {archivingBookings ? 'Архивация...' : 'Архивировать все'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>Точно?</span>
                <button
                  className="btn btn-danger"
                  onClick={handleArchiveBookings}
                  disabled={archivingBookings}
                  style={{ fontSize: '13px', padding: '8px 14px' }}
                >
                  Да, архивировать
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmArchiveBookings(false)}
                  disabled={archivingBookings}
                  style={{ fontSize: '13px', padding: '8px 14px' }}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Архивация пользователей */}
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#dc2626" />
                Архивация всех пользователей (кроме админов)
              </strong>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                Все обычные пользователи получат статус «archived» и не смогут входить в систему. Администраторы сохранят доступ.
              </p>
            </div>
            {!confirmArchiveUsers ? (
              <button
                className="btn btn-danger"
                onClick={() => setConfirmArchiveUsers(true)}
                disabled={archivingUsers}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
              >
                <Users size={16} />
                {archivingUsers ? 'Архивация...' : 'Архивировать пользователей'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>Точно?</span>
                <button
                  className="btn btn-danger"
                  onClick={handleArchiveUsers}
                  disabled={archivingUsers}
                  style={{ fontSize: '13px', padding: '8px 14px' }}
                >
                  Да, архивировать
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmArchiveUsers(false)}
                  disabled={archivingUsers}
                  style={{ fontSize: '13px', padding: '8px 14px' }}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};