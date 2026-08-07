import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
            <Toaster 
              position="bottom-right"
              toastOptions={{
                duration: 3500,
                style: {
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '13px',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
                },
                success: {
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#ffffff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#ffffff',
                  },
                },
              }}
            />
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