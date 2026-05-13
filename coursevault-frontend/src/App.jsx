import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';
import MyLearningPage from './pages/MyLearningPage.jsx';
import CourseDetailPage from './pages/CourseDetailPage.jsx';
import EducatorDashboardPage from './pages/EducatorDashboardPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import './styles/globals.css';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null; 
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<AuthPage />} />
          
          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/explore" replace />} />
            
            {/* Student Specific */}
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/my-learning" element={<MyLearningPage />} />
            
            {/* Educator Specific */}
            <Route path="/dashboard" element={<EducatorDashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            
            {/* Common Course View */}
            <Route path="/course/:id" element={<CourseDetailPage />} />
          </Route>
          
          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/explore" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}