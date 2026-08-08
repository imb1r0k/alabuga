import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyBookingsHistory, getMyTeam } from '../services/api';
import { UserProfileCard } from '../components/dashboard/UserProfileCard';
import { BookingHistory } from '../components/dashboard/BookingHistory';
import { TeamSection } from '../components/dashboard/TeamSection';
import { TeamChat } from '../components/dashboard/TeamChat';
import { TeamCalendar } from '../components/dashboard/TeamCalendar';

export const DashboardPage = () => {
  const { isAuthenticated, loading, user, refreshUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [teamData, setTeamData] = useState<{ team: any; members: any[] }>({ team: null, members: [] });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      const loadData = async () => {
        setLoadingData(true);
        try {
          const [bookingsData, team] = await Promise.all([
            getMyBookingsHistory(),
            getMyTeam(),
          ]);
          setBookings(bookingsData);
          setTeamData(team);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingData(false);
        }
      };
      loadData();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>Требуется авторизация</h2>
          <p style={{ color: '#666', textAlign: 'center' }}>Для доступа к личному кабинету необходимо войти в систему.</p>
        </div>
      </div>
    );
  }

  if (loading || loadingData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const handleProfileUpdate = () => {
    refreshUser(); // обновляем данные в контексте
  };

  const hasTeam = !!teamData.team;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', marginBottom: '24px' }}>
        Личный кабинет
      </h1>

      {/* Профиль */}
      <UserProfileCard user={user} onUpdate={handleProfileUpdate} />

      {/* История бронирований */}
      <BookingHistory bookings={bookings} />

      {/* Команда */}
      <TeamSection team={teamData.team} members={teamData.members} />

      {/* Чат и календарь доступны только если есть команда */}
      {hasTeam && (
        <>
          <TeamChat teamId={teamData.team.id} />
          <TeamCalendar teamId={teamData.team.id} />
        </>
      )}
    </div>
  );
};