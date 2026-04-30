import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import HomePage from './HomePage';
import MyAppointments from './MyAppointments';
import SavedSalons from './SavedSalons';
import BookingHistory from './BookingHistory';
import Profile from './Profile';
import SalonDetails from './SalonDetails';
import BookingStep1 from './BookingStep1';
import BookingStep2 from './BookingStep2';
import BookingStep3 from './BookingStep3';
import BookingStep4 from './BookingStep4';
import BookingSuccess from './BookingSuccess';
import AdminLoginPage from './AdminLoginPage';
import AdminDashboard from './AdminDashboard';
import AdminAppointments from './AdminAppointments';
import AdminServices from './AdminServices';
import AdminLookbook from './AdminLookbook';
import AdminLoyalty from './AdminLoyalty';
import AdminSettings from './AdminSettings';
import AdminReviews from './AdminReviews';
import AdminStaff from './AdminStaff';
import SearchPage from './SearchPage';
import { BookingProvider } from './BookingContext';
import { AuthProvider } from './AuthContext';
import ProtectedCustomerRoute from './ProtectedCustomerRoute';
import ProtectedAdminRoute from './ProtectedAdminRoute';

function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />

            <Route path="/home" element={<ProtectedCustomerRoute><HomePage /></ProtectedCustomerRoute>} />
            <Route path="/my-appointments" element={<ProtectedCustomerRoute><MyAppointments /></ProtectedCustomerRoute>} />
            <Route path="/saved-salons" element={<ProtectedCustomerRoute><SavedSalons /></ProtectedCustomerRoute>} />
            <Route path="/booking-history" element={<ProtectedCustomerRoute><BookingHistory /></ProtectedCustomerRoute>} />
            <Route path="/profile" element={<ProtectedCustomerRoute><Profile /></ProtectedCustomerRoute>} />
            <Route path="/salon/:salonId" element={<ProtectedCustomerRoute><SalonDetails /></ProtectedCustomerRoute>} />
            <Route path="/search" element={<ProtectedCustomerRoute><SearchPage /></ProtectedCustomerRoute>} />
            <Route path="/book-appointment" element={<ProtectedCustomerRoute><BookingStep1 /></ProtectedCustomerRoute>} />
            <Route path="/book-step2" element={<ProtectedCustomerRoute><BookingStep2 /></ProtectedCustomerRoute>} />
            <Route path="/book-step3" element={<ProtectedCustomerRoute><BookingStep3 /></ProtectedCustomerRoute>} />
            <Route path="/book-step4" element={<ProtectedCustomerRoute><BookingStep4 /></ProtectedCustomerRoute>} />
            <Route path="/booking-success" element={<ProtectedCustomerRoute><BookingSuccess /></ProtectedCustomerRoute>} />

            <Route path="/admin-dashboard" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
            <Route path="/admin-appointments" element={<ProtectedAdminRoute><AdminAppointments /></ProtectedAdminRoute>} />
            <Route path="/admin-services" element={<ProtectedAdminRoute><AdminServices /></ProtectedAdminRoute>} />
            <Route path="/admin-lookbook" element={<ProtectedAdminRoute><AdminLookbook /></ProtectedAdminRoute>} />
            <Route path="/admin-reviews" element={<ProtectedAdminRoute><AdminReviews /></ProtectedAdminRoute>} />
            <Route path="/admin-staff" element={<ProtectedAdminRoute><AdminStaff /></ProtectedAdminRoute>} />
            <Route path="/admin-loyalty" element={<ProtectedAdminRoute><AdminLoyalty /></ProtectedAdminRoute>} />
            <Route path="/admin-settings" element={<ProtectedAdminRoute><AdminSettings /></ProtectedAdminRoute>} />
          </Routes>
        </Router>
      </BookingProvider>
    </AuthProvider>
  );
}

export default App;