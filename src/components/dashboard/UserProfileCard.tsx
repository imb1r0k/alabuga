import React, { useState } from 'react';
import { Pencil, Save, X, User, Camera, Send, Globe, MessageCircle, ExternalLink, Star } from 'lucide-react';
import { useToast } from '../Toast';
import { updateMyProfile } from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { Link } from 'react-router-dom';

interface Props {
  user: any;
  onUpdate: (updated: any) => void;
}

const socialFields = [
  { key: 'social_vk', label: 'VK', icon: MessageCircle },
  { key: 'social_telegram', label: 'Telegram', icon: Send },
  { key: 'social_instagram', label: 'Instagram', icon: Camera },
  { key: 'social_max', label: 'Max', icon: Globe },
];

export const UserProfileCard: React.FC<Props> = ({ user, onUpdate }) => {
  const { showToast } = useToast();
  const { showRating } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [socials, setSocials] = useState<Record<string, string>>({
    social_vk: user?.social_vk || '',
    social_telegram: user?.social_telegram || '',
    social_instagram: user?.social_instagram || '',
    social_max: user?.social_max || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateMyProfile({ bio, ...socials });
      onUpdate(updated);
      setIsEditing(false);
      showToast('Профиль обновлён', 'success');
    } catch (err: any) {
      showToast('Ошибка при сохранении: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  const publicProfileUrl = `${window.location.origin}/public_profile/${user?.login}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicProfileUrl)}`;

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={20} color="#0284c7" /> Мой профиль
        </h3>
        {!isEditing && (
          <button className="btn btn-secondary" onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <Pencil size={16} /> Редактировать профиль
          </button>
        )}
      </div>

      {!isEditing ? (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <strong>ФИО:</strong> {user?.last_name} {user?.first_name}
            {showRating && (
              <span style={{ marginLeft: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 600 }}>
                <Star size={14} /> {user?.rating ?? 0} баллов
              </span>
            )}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>Логин:</strong> {user?.login}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>Телефон:</strong> {user?.phone || '—'}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>О себе:</strong> {bio ? bio : '—'}
          </div>
          <div>
            <strong>Соцсети:</strong>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
              {socialFields.map(({ key, label, icon: Icon }) => (
                <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px' }}>
                  <Icon size={16} /> {label}: {socials[key] || '—'}
                </span>
              ))}
            </div>
          </div>

          {/* QR-код и ссылка на публичный профиль */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <img src={qrCodeUrl} alt="QR-код публичного профиля" style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Ваша публичная страница:</div>
              <Link to={`/public_profile/${user?.login}`} style={{ color: '#0284c7', textDecoration: 'none', fontSize: '14px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ExternalLink size={14} /> /public_profile/{user?.login}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label>О себе</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Расскажите о себе: интересы, деятельность..."
              disabled={saving}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {socialFields.map(({ key, label, icon: Icon }) => (
              <div key={key} className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon size={16} /> {label}
                </label>
                <input
                  type="text"
                  value={socials[key]}
                  onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
                  placeholder={`Ссылка на ${label}`}
                  disabled={saving}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <X size={16} /> Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
};