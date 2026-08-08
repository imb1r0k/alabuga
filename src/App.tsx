// ... (весь существующий код, добавить импорт и маршрут)
import { PublicProfilePage } from './pages/PublicProfilePage';

// В Routes добавить:
<Route path="/public_profile/:login" element={<PublicProfilePage />} />