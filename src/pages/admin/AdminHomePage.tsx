import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { AdminLayout } from '../../components/AdminLayout';

export const AdminHomePage: React.FC = () => {
  const { siteTitle, updateSiteTitle } = useSettings();
  const [titleInput, setTitleInput] = useState(siteTitle);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleMsg, setTitleMsg] = useState('');

  useEffect(() => {
    setTitleInput(siteTitle);
  }, [siteTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
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
  };

  return (
    <AdminLayout>
      <div>
        <h3 style={{ marginBottom: '16px' }}>Основные настройки портала</h3>
        {titleMsg && (
          <div style={{ padding: '10px', borderRadius: '4px', marginBottom: '15px', backgroundColor: titleMsg.includes('Ошибка') ? '#f8d7da' : '#d4edda' }}>
            {titleMsg}
          </div>
        )}
        <form onSubmit={handleSubmit}>
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
    </AdminLayout>
  );
};