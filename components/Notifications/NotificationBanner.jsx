import { useState, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * באנר בקשת הרשאה להתראות
 */
function NotificationBanner() {
  const { isSupported, permission, requestPermission } = useNotifications();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // בדיקה אם להציג את הבאנר
  useEffect(() => {
    const wasDismissed = localStorage.getItem('notificationBannerDismissed');
    
    if (
      isSupported && 
      permission === 'default' && 
      !wasDismissed
    ) {
      // המתנה קצרה לפני הצגת הבאנר
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  // בקשת הרשאה
  const handleAllow = async () => {
    await requestPermission();
    setShowBanner(false);
  };

  // ביטול
  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('notificationBannerDismissed', 'true');
  };

  // להזכיר לי מאוחר יותר
  const handleLater = () => {
    setShowBanner(false);
    // לא שומרים ב-localStorage כדי שיוצג שוב בביקור הבא
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl">
                  🔔
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                  הפעל התראות
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  קבל תזכורות על משימות כדי שלא תפספס אף דד-ליין!
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAllow}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    אפשר התראות
                  </button>
                  <button
                    onClick={handleLater}
                    className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
                  >
                    מאוחר יותר
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NotificationBanner;

