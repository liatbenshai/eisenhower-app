import { motion } from 'framer-motion';

/**
 * לוח בקרה לניהול
 */
function AdminDashboard({ stats, users }) {
  // סטטיסטיקות משתמשים
  const activeUsers = users.filter(u => u.is_active).length;
  const newUsersThisMonth = users.filter(u => {
    const createdAt = new Date(u.created_at);
    const now = new Date();
    return createdAt.getMonth() === now.getMonth() && 
           createdAt.getFullYear() === now.getFullYear();
  }).length;

  // כרטיסי סטטיסטיקה
  const statCards = [
    {
      title: 'משתמשים רשומים',
      value: stats?.totalUsers || users.length,
      icon: '👥',
      color: 'blue',
      change: `+${newUsersThisMonth} החודש`
    },
    {
      title: 'משתמשים פעילים',
      value: activeUsers,
      icon: '✅',
      color: 'green',
      change: `${users.length > 0 ? Math.round((activeUsers / users.length) * 100) : 0}%`
    },
    {
      title: 'סה"כ משימות',
      value: stats?.totalTasks || 0,
      icon: '📋',
      color: 'purple',
      change: ''
    },
    {
      title: 'משימות שהושלמו',
      value: stats?.completedTasks || 0,
      icon: '🎯',
      color: 'orange',
      change: stats?.totalTasks > 0 
        ? `${Math.round((stats.completedTasks / stats.totalTasks) * 100)}%` 
        : '0%'
    }
  ];

  // צבעים
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
  };

  return (
    <div className="space-y-6">
      {/* כרטיסי סטטיסטיקה */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card p-5"
          >
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors[card.color]}`}>
                {card.icon}
              </div>
              {card.change && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {card.change}
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {card.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {card.title}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* חלוקת משימות לפי רבע */}
      {stats?.tasksByQuadrant && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-5"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            חלוקת משימות לפי רבע
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { id: 1, name: 'דחוף וחשוב', icon: '🔴', color: 'red' },
              { id: 2, name: 'חשוב', icon: '🔵', color: 'blue' },
              { id: 3, name: 'דחוף', icon: '🟠', color: 'orange' },
              { id: 4, name: 'לא דחוף', icon: '⚫', color: 'gray' }
            ].map(quadrant => (
              <div 
                key={quadrant.id}
                className={`p-4 rounded-lg bg-${quadrant.color}-50 dark:bg-${quadrant.color}-900/20 text-center`}
              >
                <span className="text-2xl">{quadrant.icon}</span>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.tasksByQuadrant[quadrant.id]}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {quadrant.name}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* משתמשים אחרונים */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card p-5"
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          משתמשים אחרונים
        </h3>
        <div className="space-y-3">
          {users.slice(0, 5).map(user => (
            <div 
              key={user.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.full_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                user.is_active 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {user.is_active ? 'פעיל' : 'מושהה'}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default AdminDashboard;

