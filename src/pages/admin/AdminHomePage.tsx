import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../components/Toast';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminStatsWidget } from '../../components/AdminStatsWidget';
import { AdminCleanupPanel } from '../../components/AdminCleanupPanel';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { getGlobalNotification, saveGlobalNotification } from '../../services/api';

export const AdminHomePage: React.FC = () => {
  const { siteTitle, hero, showRating, updateAllSettings } = useSettings();
  const { showToast } = useToast();

  // Состояния для всех полей
  const [titleInput, setTitleInput] = useState(siteTitle);
  const [badgeInput, setBadgeInput] = useState(hero.hero_badge);
  const [titleHeroInput, setTitleHeroInput] = useState(hero.hero_title);
  const [descInput, setDescInput] = useState(hero.hero_description);
  const [btnTextInput, setBtnTextInput] = useState(hero.hero_button_text);
  const [btnTextAuthInput, setBtnTextAuthInput] = useState(hero.hero_button_text_auth);
  const [showRatingInput, setShowRatingInput] = useState(showRating);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Глобальное уведомление
  const [notifText, setNotifText] = useState('');
  const [notifType, setNotifType] = useState<'permanent' | 'one-view'>('permanent');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  // Скрываемость блока настроек
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Загружаем текущее глобальное уведомление из БД
  const loadNotification = async () => {
    try {
      const data = await getGlobalNotification();
      const n = data?.notification;
      if (n && typeof n.text === 'string') {
        setNotifText(n.text);
        setNotifType(n.type === 'one-view' ? 'one-view' : 'permanent');
        setNotifEnabled(!!n.enabled);
      } else {
        setNotifText('');
        setNotifType('permanent');
        setNotifEnabled(false);
      }
    } catch (err) {
      console.error('Ошибка загрузки уведомления:', err);
    }
  };

  useEffect(() => {
    loadNotification();
  }, []);

  // Синхронизация hero настроек при изменении их в контексте
  useEffect(() => {
    setTitleInput(siteTitle);
    setBadgeInput(hero.hero_badge);
    setTitleHeroInput(hero.hero_title);
    setDescInput(hero.hero_description);
    setBtnTextInput(hero.hero_button_text);
    setBtnTextAuthInput(hero.hero_button_text_auth);
  }, [siteTitle, hero]);

  useEffect(() => {
    setShowRatingInput(showRating);
  }, [showRating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await updateAllSettings({
        site_title: titleInput,
        hero_badge: badgeInput,
        hero_title: titleHeroInput,
        hero_description: descInput,
        hero_button_text: btnTextInput,
        hero_button_text_auth: btnTextAuthInput,
        show_rating: showRatingInput ? '1' : '0',
      });
      setMsg('Все настройки успешно сохранены!');
      showToast('Все настройки успешно сохранены!', 'success');
    } catch (err: any) {
      const errorText = 'Ошибка: ' + (err.response?.data?.error || err.message);
      setMsg(errorText);
      showToast(errorText, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifText.trim()) {
      showToast('Введите текст уведомления', 'error');
      return;
    }
    setNotifSaving(true);
    try {
      await saveGlobalNotification({
        text: notifText,
        type: notifType,
        enabled: notifEnabled,
      });
      showToast('Глобальное уведомление сохранено', 'success');
      await loadNotification();
    } catch (err: any) {
      showToast('Ошибка сохранения: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setNotifSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Заголовок */}
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Панель управления</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
            Сводная статистика и управление порталом
          </p>
        </div>

        {/* Статистика */}
        <AdminStatsWidget />

        {/* Управление очисткой и экспортом */}
        <AdminCleanupPanel />

        {/* Настройки портала (скрываемый блок) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              border: 'none',
              borderBottom: settingsOpen ? '1px solid #e2e8f0' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '15px',
              fontWeight: 600,
              color: '#0f172a',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings2 size={18} color="#0284c7" />
              Настройки портала
            </span>
            {settingsOpen ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
          </button>

          {settingsOpen && (
            <div style={{ padding: '24px' }}>
              {msg && (
                <div style={{
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '15px',
                  backgroundColor: msg.includes('Ошибка') ? '#f8d7da' : '#d4edda',
                  color: msg.includes('Ошибка') ? '#721c24' : '#155724',
                }}>
                  {msg}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
                  <h4 style={{ marginBottom: '12px', color: '#1e293b' }}>Название сайта (шапка)</h4>
                  <div className="input-group">
                    <label>Название сайта</label>
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      required
                      disabled={saving}
                    />
                    <small style={{ color: '#64748b', fontSize: '12px' }}>
                      Можно вставить текст или прямую ссылку на изображение (svg/png) — тогда в шапке будет отображаться картинка.
                    </small>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ marginBottom: '12px', color: '#1e293b' }}>Hero-блок на главной странице</h4>

                  <div className="input-group">
                    <label>Бейдж (ярлык сверху)</label>
                    <input
                      type="text"
                      value={badgeInput}
                      onChange={(e) => setBadgeInput(e.target.value)}
                      disabled={saving}
                      placeholder="Например: Форум 2025"
                    />
                  </div>

                  <div className="input-group">
                    <label>Заголовок (можно использовать HTML-теги)</label>
                    <textarea
                      value={titleHeroInput}
                      onChange={(e) => setTitleHeroInput(e.target.value)}
                      rows={3}
                      disabled={saving}
                      placeholder="Например: Добро пожаловать в систему проживания <span style=&quot;color: #38bdf8&quot;>Алабуга</span>"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Описание</label>
                    <textarea
                      value={descInput}
                      onChange={(e) => setDescInput(e.target.value)}
                      rows={3}
                      disabled={saving}
                      placeholder="Описание под заголовком"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Текст кнопки (для неавторизованных)</label>
                    <input
                      type="text"
                      value={btnTextInput}
                      onChange={(e) => setBtnTextInput(e.target.value)}
                      disabled={saving}
                      placeholder="Например: Войти / Зарегистрироваться"
                    />
                  </div>

                  <div className="input-group">
                                      <label>Текст кнопки (для авторизованных)</label>
                                      <input
                                        type="text"
                                        value={btnTextAuthInput}
                                        onChange={(e) => setBtnTextAuthInput(e.target.value)}
                                        disabled={saving}
                                        placeholder="Например: Перейти в личный кабинет"
                                      />
                                    </div>
                                  </div>
                  
                                  <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ marginBottom: '12px', color: '#1e293b' }}>Рейтинг пользователей</h4>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#334155' }}>
                                      <input
                                        type="checkbox"
                                        checked={showRatingInput}
                                        onChange={(e) => setShowRatingInput(e.target.checked)}
                                        disabled={saving}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                      />
                                      Показывать рейтинг пользователей (в личном кабинете, на публичных страницах и в командах)
                                    </label>
                                  </div>
                  
                                  <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Сохранение...' : 'Сохранить все настройки'}
                                  </button>
              </form>

              {/* Глобальное уведомление */}
              <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <h4 style={{ marginBottom: '8px', color: '#1e293b' }}>📢 Глобальное уведомление</h4>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Уведомление будет показываться всем пользователям в верхней части сайта. Фронтенд проверяет базу каждые 5 секунд.
                </p>

                <form onSubmit={handleSaveNotification}>
                  <div className="input-group">
                    <label>Текст уведомления</label>
                    <textarea
                      value={notifText}
                      onChange={(e) => setNotifText(e.target.value)}
                      rows={3}
                      disabled={notifSaving}
                      placeholder="Например: Уважаемые участники, регистрация на форум открыта!"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label>Тип уведомления</label>
                      <select
                        value={notifType}
                        onChange={(e) => setNotifType(e.target.value as any)}
                        disabled={notifSaving}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '180px' }}
                      >
                        <option value="permanent">Permanent — показывать всегда</option>
                        <option value="one-view">One-view — показать один раз</option>
                      </select>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={notifEnabled}
                        onChange={(e) => setNotifEnabled(e.target.checked)}
                        disabled={notifSaving}
                        style={{ width: '18px', height: '18px' }}
                      />
                      Уведомление включено
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={notifSaving}>
                    {notifSaving ? 'Сохранение...' : 'Сохранить уведомление'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};