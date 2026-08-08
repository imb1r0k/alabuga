import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../components/Toast';
import { AdminLayout } from '../../components/AdminLayout';

export const AdminHomePage: React.FC = () => {
  const { siteTitle, hero, updateAllSettings } = useSettings();
  const { showToast } = useToast();

  // Состояния для всех полей
  const [titleInput, setTitleInput] = useState(siteTitle);
  const [badgeInput, setBadgeInput] = useState(hero.hero_badge);
  const [titleHeroInput, setTitleHeroInput] = useState(hero.hero_title);
  const [descInput, setDescInput] = useState(hero.hero_description);
  const [btnTextInput, setBtnTextInput] = useState(hero.hero_button_text);
  const [btnTextAuthInput, setBtnTextAuthInput] = useState(hero.hero_button_text_auth);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setTitleInput(siteTitle);
    setBadgeInput(hero.hero_badge);
    setTitleHeroInput(hero.hero_title);
    setDescInput(hero.hero_description);
    setBtnTextInput(hero.hero_button_text);
    setBtnTextAuthInput(hero.hero_button_text_auth);
  }, [siteTitle, hero]);

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

  return (
    <AdminLayout>
      <div>
        <h3 style={{ marginBottom: '16px' }}>Основные настройки портала</h3>

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
                placeholder="Например: Добро пожаловать в систему проживания &lt;span style=&quot;color: #38bdf8&quot;&gt;Алабуга&lt;/span&gt;"
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

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить все настройки'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
};