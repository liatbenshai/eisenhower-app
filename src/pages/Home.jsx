import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * דף הבית - דף נחיתה
 */
function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* כותרת */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            מטריצת אייזנהאואר
          </h1>
          <div className="flex gap-4">
            <Link 
              to="/login" 
              className="btn-secondary"
            >
              התחבר
            </Link>
            <Link 
              to="/register" 
              className="btn-primary"
            >
              הירשם חינם
            </Link>
          </div>
        </nav>
      </header>

      {/* גיבור */}
      <main className="container mx-auto px-4 py-12 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <motion.h2 
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            נהל את הזמן שלך
            <span className="text-blue-600 dark:text-blue-400"> בחכמה</span>
          </motion.h2>
          
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            מטריצת אייזנהאואר עוזרת לך לתעדף משימות לפי דחיפות וחשיבות.
            התמקד במה שבאמת חשוב והשג יותר בפחות זמן.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link 
              to="/register" 
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              התחל עכשיו - חינם
            </Link>
          </motion.div>
        </div>

        {/* תצוגת המטריצה */}
        <motion.div 
          className="mt-16 max-w-4xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="grid grid-cols-2 gap-4 p-4">
            {/* רבע 1 - דחוף וחשוב */}
            <div className="quadrant-1 border-2 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🔴</span>
                <h3 className="font-bold text-red-700 dark:text-red-300">דחוף וחשוב</h3>
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm">עשה עכשיו</p>
              <ul className="mt-3 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                <li>• משברים ובעיות דחופות</li>
                <li>• דד-ליינים קרובים</li>
              </ul>
            </div>

            {/* רבע 2 - חשוב אך לא דחוף */}
            <div className="quadrant-2 border-2 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🔵</span>
                <h3 className="font-bold text-blue-700 dark:text-blue-300">חשוב אך לא דחוף</h3>
              </div>
              <p className="text-blue-600 dark:text-blue-400 text-sm">תכנן</p>
              <ul className="mt-3 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                <li>• מטרות ארוכות טווח</li>
                <li>• למידה והתפתחות</li>
              </ul>
            </div>

            {/* רבע 3 - דחוף אך לא חשוב */}
            <div className="quadrant-3 border-2 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🟠</span>
                <h3 className="font-bold text-orange-700 dark:text-orange-300">דחוף אך לא חשוב</h3>
              </div>
              <p className="text-orange-600 dark:text-orange-400 text-sm">האצל</p>
              <ul className="mt-3 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                <li>• הפרעות</li>
                <li>• בקשות של אחרים</li>
              </ul>
            </div>

            {/* רבע 4 - לא דחוף ולא חשוב */}
            <div className="quadrant-4 border-2 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚫</span>
                <h3 className="font-bold text-gray-700 dark:text-gray-300">לא דחוף ולא חשוב</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">בטל</p>
              <ul className="mt-3 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                <li>• בזבוז זמן</li>
                <li>• הסחות דעת</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* תכונות */}
        <div className="mt-24 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <motion.div 
            className="text-center p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📱</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">רספונסיבי</h3>
            <p className="text-gray-600 dark:text-gray-400">עובד מעולה בכל מכשיר - מחשב, טאבלט או נייד</p>
          </motion.div>

          <motion.div 
            className="text-center p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔔</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">תזכורות</h3>
            <p className="text-gray-600 dark:text-gray-400">קבל התראות לפני משימות ולעולם לא תפספס דד-ליין</p>
          </motion.div>

          <motion.div 
            className="text-center p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ייצוא</h3>
            <p className="text-gray-600 dark:text-gray-400">ייצא את המשימות שלך ל-PDF, Excel או CSV</p>
          </motion.div>
        </div>
      </main>

      {/* פוטר */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} מטריצת אייזנהאואר. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
}

export default Home;

