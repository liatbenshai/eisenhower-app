import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * רכיב הגנה על מסלול - מאפשר גישה רק למשתמשים מחוברים
 */
function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  // מסך טעינה
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">טוען...</p>
        </div>
      </div>
    );
  }

  // אין משתמש מחובר - הפניה להתחברות
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // בדיקת הרשאות מנהל
  if (requireAdmin && !isAdmin()) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <span className="text-4xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            אין הרשאה
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            אין לך הרשאה לגשת לדף זה.
          </p>
        </div>
      </div>
    );
  }

  // בדיקה אם המשתמש פעיל
  if (user.profile?.is_active === false) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <span className="text-4xl mb-4 block">⏸️</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            החשבון הושהה
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            החשבון שלך הושהה. פנה למנהל המערכת לפרטים נוספים.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;

