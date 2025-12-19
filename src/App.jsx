import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// דפים
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import TaskInsights from './pages/TaskInsights';

// רכיבים
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Header from './components/Layout/Header';
import InstallPrompt from './components/PWA/InstallPrompt';

function App() {
  const { user, loading } = useAuth();

  // מסך טעינה
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* הודעות Toast */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            direction: 'rtl',
            fontFamily: 'Arial, sans-serif'
          }
        }}
      />

      {/* הודעת התקנת PWA */}
      <InstallPrompt />

      {/* כותרת עליונה */}
      {user && <Header />}

      {/* ניתוב */}
      <Routes>
        {/* דף בית */}
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Home />} />
        
        {/* התחברות והרשמה */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        
        {/* דפים מוגנים */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        
        <Route path="/insights" element={
          <ProtectedRoute>
            <TaskInsights />
          </ProtectedRoute>
        } />
        
        {/* פאנל ניהול - רק למנהלים */}
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <Admin />
          </ProtectedRoute>
        } />

        {/* דף 404 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;

