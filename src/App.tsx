import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { AdminBuildingsPage } from './pages/admin/AdminBuildingsPage';
import { Header } from './components/Header';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <div className="app">
            <Header />
            <main>
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
                
                {/* Маршруты отдельных страниц админ-панели */}
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
                  path="/admin-panel/bookings" 
                  element={
                    <ProtectedRoute>
                      <AdminBookingsPage />
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

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;