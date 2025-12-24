import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { motion } from 'framer-motion';

/**
 * סרגל צד (לשימוש עתידי בתצוגה מורחבת)
 */
function Sidebar({ isOpen, onClose }) {
  const { user, isAdmin } = useAuth();
  const { getStats } = useTasks();
  const location = useLocation();
  const stats = getStats();

  // קישורי ניווט
  const navLinks = [
    { path: '/dashboard', label: 'לוח משימות', icon: '📋' },
    { path: '/insights', label: 'תובנות למידה', icon: '📊' },
    { path: '/settings', label: 'הגדרות', icon: '⚙️' }
  ];

  if (isAdmin()) {
    navLinks.push({ path: '/admin', label: 'ניהול', icon: '🛡️' });
  }

  return (
    <>
      {/* רקע כהה */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* סרגל צד */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`
          fixed top-0 right-0 h-full w-72
          bg-white dark:bg-gray-800
          border-l border-gray-200 dark:border-gray-700
          z-50 lg:hidden
          overflow-y-auto
        `}
      >
        {/* כותרת */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <span className="font-bold text-gray-900 dark:text-white">מטריצת אייזנהאואר</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* פרטי משתמש */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-medium">
              {user?.profile?.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {user?.profile?.full_name || 'משתמש'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* ניווט */}
        <nav className="p-4">
          <ul className="space-y-2">
            {navLinks.map(link => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === link.path
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* סטטיסטיקות */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            סטטיסטיקות
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">סה"כ</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">הושלמו</p>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export default Sidebar;

