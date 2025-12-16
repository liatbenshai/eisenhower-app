import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAllUsers, getStats, toggleUserActive, deleteUser } from '../services/supabase';
import AdminDashboard from '../components/Admin/AdminDashboard';
import UserManagement from '../components/Admin/UserManagement';
import toast from 'react-hot-toast';

/**
 * דף ניהול - רק למנהלים
 */
function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // טעינת נתונים
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        getAllUsers(),
        getStats()
      ]);
      setUsers(usersData || []);
      setStats(statsData);
    } catch (err) {
      console.error('שגיאה בטעינת נתונים:', err);
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  // השהיית/הפעלת משתמש
  const handleToggleUser = async (userId, isActive) => {
    try {
      await toggleUserActive(userId, isActive);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: isActive } : u));
      toast.success(isActive ? 'המשתמש הופעל' : 'המשתמש הושהה');
    } catch (err) {
      toast.error('שגיאה בעדכון המשתמש');
    }
  };

  // מחיקת משתמש
  const handleDeleteUser = async (userId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה? פעולה זו בלתי הפיכה.')) {
      return;
    }

    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      toast.success('המשתמש נמחק');
    } catch (err) {
      toast.error('שגיאה במחיקת המשתמש');
    }
  };

  // טאבים
  const tabs = [
    { id: 'dashboard', label: 'לוח בקרה', icon: '📊' },
    { id: 'users', label: 'ניהול משתמשים', icon: '👥' }
  ];

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* כותרת */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🛡️</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            פאנל ניהול
          </h1>
        </div>

        {/* טאבים */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* תוכן */}
        {activeTab === 'dashboard' && (
          <AdminDashboard stats={stats} users={users} />
        )}

        {activeTab === 'users' && (
          <UserManagement 
            users={users}
            onToggleUser={handleToggleUser}
            onDeleteUser={handleDeleteUser}
            onRefresh={loadData}
          />
        )}
      </motion.div>
    </div>
  );
}

export default Admin;

