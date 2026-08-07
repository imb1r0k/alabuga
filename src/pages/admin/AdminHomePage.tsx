import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSettings } from '../../contexts/SettingsContext';
import { AdminLayout } from '../../components/AdminLayout';
import { getAdminUsers, getAdminBookings, getAdminBuildings } from '../../services/api';
import { Settings, Users, BookmarkCheck, Building2, Save, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminHomePage: React.FC = () => {
  const { siteTitle, updateSiteTitle } = useSettings();
  const [titleInput, setTitleInput] = useState(siteTitle);
  const [savingTitle, setSavingTitle] = useState(false);

  const [stats, setStats] = useState({ users: 0, bookings: 0, buildings: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setTitleInput(siteTitle);
    loadDashboardStats();
  }, [siteTitle]);

  const loadDashboardStats = async () => {
    try {
      const [u, b, bu] = await Promise.all([
        getAdminUsers().catch(() => []),
        getAdminBookings().catch(() => []),
        getAdminBuildings().catch(() => [])
      ]);
      setStats({
        users: u.length || 0,
        bookings: b.length || 0,
        buildings: bu.length || 0
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) {
      toast.error('Название портала не может быть пустым');
      return;
    }
    setSavingTitle(true);
    try {
      await updateSiteTitle(titleInput);
      toast.success('Название сайта успешно обновлено!');
    } catch (err: any) {
      toast.error('Ошибка: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <AdminLayout>
      <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Приветственный баннер */}
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          color: '#ffffff',
          marginBottom: '28px',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>
              <Sparkles size={14} /> Панель управления Алабуга 2025
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              Добро пожаловать в систему администратора
            </h1>
            <p style={{ margin: 0, opacity: 0.9, fontSize: '14px', maxWidth: '600px' }}>
              Здесь вы можете гибко управлять названиями портала, списком корпусов, комнатами и бронированиями участников в режиме реального времени.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={28} />
            </div>
          </div>
        </div>

        {/* Быстрая статистика */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          <Link to="/admin-panel/users" style={{ textDecoration: 'none' }}>
            <div className="admin-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={24} />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Пользователи</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {loadingStats ? '...' : stats.users}
                </div>
              </div>
            </div>
          </Link>

          <Link to="/admin-panel/bookings" style={{ textDecoration: 'none' }}>
            <div className="admin-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookmarkCheck size={24} />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Всего бронирований</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {loadingStats ? '...' : stats.bookings}
                </div>
              </div>
            </div>
          </Link>

          <Link to="/admin-panel/buildings" style={{ textDecoration: 'none' }}>
            <div className="admin-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f3e8ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={24} />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Корпуса и этажи</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {loadingStats ? '...' : stats.buildings}
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Форма основных настроек */}
        <div className="admin-card" style={{ padding: '28px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <Settings size={22} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Основные настройки портала
            </h3>
          </div>

          <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <label>Название сайта (сохраняется в базе данных)</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="например, Алабуга - форум 2025"
                required
                disabled={savingTitle}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingTitle}>
              <Save size={16} />
              {savingTitle ? 'Сохранение...' : 'Сохранить название'}
            </button>
          </form>
        </div>

        {/* Ссылки быстрого перехода */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <Link to="/admin-panel/buildings" style={{ textDecoration: 'none' }}>
            <div className="admin-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Редактор корпусов</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Управление комнатами и автогенерацией</p>
              </div>
              <ArrowRight size={18} color="var(--accent-primary)" />
            </div>
          </Link>

          <Link to="/admin-panel/bookings" style={{ textDecoration: 'none' }}>
            <div className="admin-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Модерация броней</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Одобрение и отклонение заявок</p>
              </div>
              <ArrowRight size={18} color="var(--accent-primary)" />
            </div>
          </Link>
        </div>

      </div>
    </AdminLayout>
  );
};