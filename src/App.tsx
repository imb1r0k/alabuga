// ... (весь существующий код)
// Добавить импорт:
import { AdminTeamsPage } from './pages/admin/AdminTeamsPage';

// Вставить маршрут после существующих админских маршрутов:
<Route 
  path="/admin-panel/teams" 
  element={
    <ProtectedRoute>
      <AdminTeamsPage />
    </ProtectedRoute>
  } 
/>