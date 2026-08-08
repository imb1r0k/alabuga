// В импорты добавим:
import { QrCode, Link as LinkIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

// В состоянии добавим:
const [publicUser, setPublicUser] = useState<any>(null); // для модалки QR

// В таблице, после строки с пользователем добавим кнопку:
<td style={{ padding: '10px' }}>
  <button
    onClick={(e) => { e.stopPropagation(); setPublicUser(u); }}
    className="btn btn-secondary"
    style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
  >
    <QrCode size={14} /> QR
  </button>
  <Link
    to={`/public_profile/${u.login}`}
    target="_blank"
    className="btn btn-secondary"
    style={{ fontSize: '12px', padding: '4px 8px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
  >
    <LinkIcon size={14} /> Открыть
  </Link>
</td>

// В конце компонента (перед закрывающими тегами) добавим модалку:
{publicUser && (
  <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
      <h3 style={{ marginBottom: '16px' }}>{publicUser.last_name} {publicUser.first_name}</h3>
      <QRCodeSVG value={`${window.location.origin}/public_profile/${publicUser.login}`} size={180} style={{ margin: '0 auto' }} />
      <p style={{ marginTop: '12px', fontSize: '14px', color: '#475569' }}>
        Ссылка: <a href={`/public_profile/${publicUser.login}`} target="_blank" rel="noopener noreferrer">{`/public_profile/${publicUser.login}`}</a>
      </p>
      <button className="btn btn-secondary" onClick={() => setPublicUser(null)} style={{ marginTop: '12px' }}>Закрыть</button>
    </div>
  </div>
)}