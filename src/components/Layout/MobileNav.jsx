import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * ניווט תחתון לנייד - 5 עמודים
 */
function MobileNav() {
  const location = useLocation();

  const navLinks = [
    { path: '/dashboard', label: 'דשבורד', icon: '🏠' },
    { path: '/daily', label: 'יומי', icon: '📅' },
    { path: '/weekly', label: 'שבועי', icon: '📆' },
    { path: '/insights', label: 'תובנות', icon: '💡' },
    { path: '/settings', label: 'הגדרות', icon: '⚙️' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navLinks.map(link => {
          const isActive = location.pathname === link.path;
          
          return (
            <Link
              key={link.path}
              to={link.path}
              className="flex flex-col items-center justify-center flex-1 py-2 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-50 dark:bg-blue-900/30 rounded-xl mx-1"
                  transition={{ type: 'spring', duration: 0.3 }}
                />
              )}
              <span className={`text-xl relative z-10 ${isActive ? 'scale-110' : ''} transition-transform`}>
                {link.icon}
              </span>
              <span className={`text-xs mt-1 relative z-10 ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;

