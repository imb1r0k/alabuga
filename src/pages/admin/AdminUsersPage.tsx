// ... (весь существующий код)
// Импортировать getAdminTeams из api
import { getAdminUsers, updateAdminUser, getUserDetails, getAdminTeams } from '../../services/api';

// Добавить состояние для списка команд
const [teams, setTeams] = useState<any[]>([]);

// В useEffect загрузить команды
useEffect(() => {
  loadUsers();
  loadTeams();
}, []);

const loadTeams = async () => {
  try {
    const data = await getAdminTeams();
    setTeams(data);
  } catch (err) {
    console.error(err);
  }
};

// В handleSelectUser добавить team_id в форму
setUserFormData({
  id: u.id,
  first_name: u.first_name || '',
  last_name: u.last_name || '',
  phone: u.phone || '',
  email: u.email || '',
  role: u.role || 'user',
  team_name: u.team_name || '',
  team_id: u.team_id || 0,
  password: '',
});

// Заменить поле "Команда" (input) на select:
<div className="input-group">
  <label>Команда</label>
  <select
    value={userFormData.team_id || 0}
    onChange={(e) => {
      const teamId = Number(e.target.value);
      const team = teams.find(t => t.id === teamId);
      setUserFormData({
        ...userFormData,
        team_id: teamId,
        team_name: team ? team.name : ''
      });
    }}
    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
  >
    <option value={0}>— Без команды —</option>
    {teams.map(team => (
      <option key={team.id} value={team.id}>{team.name}</option>
    ))}
  </select>
</div>