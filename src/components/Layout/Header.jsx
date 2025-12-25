import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';

/**
 * כותרת עליונה
 */
function Header() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // בדיקת מצב כהה בעליה
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  // החלפת מצב כהה/בהיר
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // התנתקות
  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('שגיאה בהתנתקות:', err);
    }
  };

  // קישורי ניווט
  const navLinks = [
    { path: '/planner', label: 'תכנון חכם', icon: '🎯' },
    { path: '/daily', label: 'יומן', icon: '📅' },
    { path: '/dashboard', label: 'דשבורד', icon: '📋' },
    { path: '/insights', label: 'תובנות', icon: '📊' },
    { path: '/settings', label: 'הגדרות', icon: '⚙️' }
  ];

  if (isAdmin()) {
    navLinks.push({ path: '/admin', label: 'ניהול', icon: '🛡️' });
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* לוגו */}
          <Link to="/planner" className="flex items-center gap-2">
            <span className="text-2xl">⏰</span>
            <span className="font-bold text-xl text-gray-900 dark:text-white hidden sm:block">
              ניהול זמן
            </span>
          </Link>

          {/* ניווט - דסקטופ */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === link.path
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* פעולות */}
          <div className="flex items-center gap-3">
            {/* כפתור מצב כהה */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={darkMode ? 'מצב בהיר' : 'מצב כהה'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            {/* תפריט משתמש */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user?.profile?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </div>
                <span className="hidden sm:block text-gray-700 dark:text-gray-300 text-sm">
                  {user?.profile?.full_name || 'משתמש'}
                </span>
              </button>

              {/* תפריט נפתח */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowUserMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden"
                  >
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {user?.profile?.full_name || 'משתמש'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </p>
                    </div>
                    
                    {/* קישורים בנייד */}
                    <div className="md:hidden py-2">
                      {navLinks.map(link => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span>{link.icon}</span>
                          <span>{link.label}</span>
                        </Link>
                      ))}
                    </div>
                    
                    <div className="py-2">
                      <Link
                        to="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <span>⚙️</span>
                        <span>הגדרות</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <span>🚪</span>
                        <span>צא מהמערכת</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

