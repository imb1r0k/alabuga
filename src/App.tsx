import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Header } from './components/Header';
import { GlobalNotification } from './pages/GlobalNotification';

import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';

import { AutoBookingPage } from './pages/AutoBookingPage';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminBuildingsPage } from './pages/admin/AdminBuildingsPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { AdminTeamsPage } from './pages/admin/AdminTeamsPage';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
              <Header />
              <GlobalNotification />
              <main style={{ flex: 1 }}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route path="/auto-booking" element={<AutoBookingPage />} />

                  {/* Маршруты админ-панели */}
                  <Route
                    path="/admin-panel"
                    element={
                      <ProtectedRoute>
                        <AdminHomePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin-panel/users"
                    element={
                      <ProtectedRoute>
                        <AdminUsersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin-panel/buildings"
                    element={
                      <ProtectedRoute>
                        <AdminBuildingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin-panel/bookings"
                    element={
                      <ProtectedRoute>
                        <AdminBookingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin-panel/teams"
                    element={
                      <ProtectedRoute>
                        <AdminTeamsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;