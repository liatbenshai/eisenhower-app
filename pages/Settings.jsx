import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import NotificationSettings from '../components/Notifications/NotificationSettings';

/**
 * דף הגדרות
 */
function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // בדיקת מצב כהה
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
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

  // טאבים
  const tabs = [
    { id: 'profile', label: 'פרופיל', icon: '👤' },
    { id: 'notifications', label: 'התראות', icon: '🔔' },
    { id: 'appearance', label: 'תצוגה', icon: '🎨' },
    { id: 'account', label: 'חשבון', icon: '⚙️' }
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          הגדרות
        </h1>

        {/* טאבים */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
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
        <div className="card p-6">
          {/* פרופיל */}
          {activeTab === 'profile' && (
            <ProfileSettings user={user} loading={loading} setLoading={setLoading} />
          )}

          {/* התראות */}
          {activeTab === 'notifications' && (
            <NotificationSettings />
          )}

          {/* תצוגה */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות תצוגה</h2>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">מצב כהה</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">החלף בין ערכת צבעים בהירה לכהה</p>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    darkMode ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span 
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      darkMode ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* חשבון */}
          {activeTab === 'account' && (
            <AccountSettings user={user} logout={logout} loading={loading} setLoading={setLoading} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * הגדרות פרופיל
 */
function ProfileSettings({ user, loading, setLoading }) {
  const [fullName, setFullName] = useState(user?.profile?.full_name || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('הפרופיל נשמר בהצלחה');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error('שגיאה בשמירת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">פרטי פרופיל</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            אימייל
          </label>
          <p className="text-gray-900 dark:text-white">{user?.email}</p>
        </div>

        <Input
          label="שם מלא"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="הזן את שמך המלא"
        />

        <Button onClick={handleSave} loading={loading}>
          {saved ? '✓ נשמר' : 'שמור שינויים'}
        </Button>
      </div>
    </div>
  );
}

/**
 * הגדרות חשבון
 */
function AccountSettings({ user, logout, loading, setLoading }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    if (passwords.new.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;
      toast.success('הסיסמה שונתה בהצלחה');
      setShowPasswordForm(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast.error('שגיאה בשינוי הסיסמה');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('התנתקת בהצלחה');
    } catch (err) {
      toast.error('שגיאה בהתנתקות');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות חשבון</h2>
      
      {/* שינוי סיסמה */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">סיסמה</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">שנה את הסיסמה שלך</p>
          </div>
          <Button 
            variant="secondary"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            שנה סיסמה
          </Button>
        </div>

        {showPasswordForm && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Input
              type="password"
              label="סיסמה חדשה"
              value={passwords.new}
              onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
              placeholder="הזן סיסמה חדשה"
            />
            <Input
              type="password"
              label="אימות סיסמה"
              value={passwords.confirm}
              onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              placeholder="הזן שוב את הסיסמה"
            />
            <Button onClick={handleChangePassword} loading={loading}>
              שמור סיסמה חדשה
            </Button>
          </div>
        )}
      </div>

      {/* התנתקות */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button variant="danger" onClick={handleLogout}>
          צא מהמערכת
        </Button>
      </div>

      {/* פרטי חשבון */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
        <p>נוצר: {new Date(user?.profile?.created_at).toLocaleDateString('he-IL')}</p>
        <p>התחברות אחרונה: {new Date(user?.profile?.last_login).toLocaleDateString('he-IL')}</p>
      </div>
    </div>
  );
}

export default Settings;

