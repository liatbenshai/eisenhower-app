import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { TASK_TYPES } from '../config/taskTypes';
import toast from 'react-hot-toast';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';

/**
 * דף הגדרות מקיף
 */
function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('work');
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
    { id: 'work', label: 'עבודה', icon: '💼' },
    { id: 'taskTypes', label: 'סוגי משימות', icon: '📋' },
    { id: 'profile', label: 'פרופיל', icon: '👤' },
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
          ⚙️ הגדרות
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          {activeTab === 'work' && <WorkSettings user={user} />}
          {activeTab === 'taskTypes' && <TaskTypesSettings user={user} />}
          {activeTab === 'profile' && <ProfileSettings user={user} loading={loading} setLoading={setLoading} />}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות תצוגה</h2>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">מצב כהה</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">החלף בין ערכת צבעים בהירה לכהה</p>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${darkMode ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          )}
          {activeTab === 'account' && <AccountSettings user={user} logout={logout} loading={loading} setLoading={setLoading} />}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * הגדרות עבודה
 */
function WorkSettings({ user }) {
  const [workHours, setWorkHours] = useState({
    startHour: 8,
    endHour: 16,
    workDays: [0, 1, 2, 3, 4]
  });
  const [preferences, setPreferences] = useState({
    bufferMinutes: 0,
    preferMorning: true
  });

  useEffect(() => {
    const saved = localStorage.getItem(`work_settings_${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.workHours) setWorkHours(parsed.workHours);
        if (parsed.preferences) setPreferences(parsed.preferences);
      } catch (e) {}
    }
  }, [user?.id]);

  const handleSave = () => {
    localStorage.setItem(`work_settings_${user?.id}`, JSON.stringify({ workHours, preferences }));
    toast.success('הגדרות העבודה נשמרו');
  };

  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  const toggleDay = (day) => {
    setWorkHours(w => ({
      ...w,
      workDays: w.workDays.includes(day) 
        ? w.workDays.filter(d => d !== day)
        : [...w.workDays, day].sort()
    }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות עבודה</h2>
      
      {/* שעות עבודה */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">שעות עבודה</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-sm text-gray-500 mb-1">התחלה</label>
            <select
              value={workHours.startHour}
              onChange={(e) => setWorkHours(w => ({ ...w, startHour: parseInt(e.target.value) }))}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 14 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <span className="text-gray-400 pt-6">עד</span>
          <div>
            <label className="block text-sm text-gray-500 mb-1">סיום</label>
            <select
              value={workHours.endHour}
              onChange={(e) => setWorkHours(w => ({ ...w, endHour: parseInt(e.target.value) }))}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 14 }, (_, i) => i + 10).map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ימי עבודה */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">ימי עבודה</h3>
        <div className="flex gap-2">
          {dayNames.map((name, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`w-10 h-10 rounded-full font-medium transition-colors ${
                workHours.workDays.includes(i)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Buffer */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">Buffer אוטומטי</h3>
        <p className="text-sm text-gray-500">הוסף זמן נוסף לכל משימה</p>
        <select
          value={preferences.bufferMinutes}
          onChange={(e) => setPreferences(p => ({ ...p, bufferMinutes: parseInt(e.target.value) }))}
          className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value={0}>ללא buffer</option>
          <option value={5}>5 דקות</option>
          <option value={10}>10 דקות</option>
          <option value={15}>15 דקות</option>
          <option value={20}>20% מהזמן</option>
        </select>
      </div>

      <Button onClick={handleSave}>שמור הגדרות</Button>
    </div>
  );
}

/**
 * הגדרות סוגי משימות
 */
function TaskTypesSettings({ user }) {
  const [customTypes, setCustomTypes] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingType, setEditingType] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(`custom_task_types_${user?.id}`);
    if (saved) {
      try { setCustomTypes(JSON.parse(saved)); } catch (e) {}
    }
  }, [user?.id]);

  const saveCustomTypes = (types) => {
    setCustomTypes(types);
    localStorage.setItem(`custom_task_types_${user?.id}`, JSON.stringify(types));
  };

  const deleteCustomType = (id) => {
    const newTypes = customTypes.filter(t => t.id !== id);
    saveCustomTypes(newTypes);
    toast.success('סוג המשימה נמחק');
  };

  const allTypes = [...Object.values(TASK_TYPES), ...customTypes];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">סוגי משימות</h2>
        <Button size="sm" onClick={() => setShowAddForm(true)}>+ הוסף סוג</Button>
      </div>
      
      <p className="text-sm text-gray-500">
        סוגי משימות מוגדרים מראש. ניתן להוסיף סוגים מותאמים אישית.
      </p>

      {/* רשימת סוגים */}
      <div className="space-y-2">
        {allTypes.map((type) => (
          <div
            key={type.id}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{type.name}</div>
                <div className="text-xs text-gray-500">
                  {type.defaultDuration ? `${type.defaultDuration} דק' ברירת מחדל` : ''}
                  {type.timeRatio && type.timeRatio !== 1 ? ` • יחס ${type.timeRatio}x` : ''}
                </div>
              </div>
            </div>
            {customTypes.find(t => t.id === type.id) && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingType(type)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteCustomType(type.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* מודל הוספה/עריכה */}
      <Modal
        isOpen={showAddForm || !!editingType}
        onClose={() => { setShowAddForm(false); setEditingType(null); }}
        title={editingType ? 'עריכת סוג משימה' : 'הוספת סוג משימה'}
      >
        <TaskTypeForm
          type={editingType}
          onSave={(newType) => {
            if (editingType) {
              const updated = customTypes.map(t => t.id === editingType.id ? newType : t);
              saveCustomTypes(updated);
            } else {
              saveCustomTypes([...customTypes, { ...newType, id: `custom_${Date.now()}` }]);
            }
            setShowAddForm(false);
            setEditingType(null);
            toast.success('נשמר בהצלחה');
          }}
          onCancel={() => { setShowAddForm(false); setEditingType(null); }}
        />
      </Modal>
    </div>
  );
}

/**
 * טופס סוג משימה
 */
function TaskTypeForm({ type, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: type?.name || '',
    icon: type?.icon || '📌',
    defaultDuration: type?.defaultDuration || 30,
    timeRatio: type?.timeRatio || 1,
    category: type?.category || 'work'
  });

  const icons = ['📌', '📝', '📞', '💼', '🎯', '⚡', '🔧', '💡', '📊', '🎨', '🏠', '🚗', '💰', '📚', '🏋️'];

  return (
    <div className="space-y-4">
      <Input
        label="שם"
        value={form.name}
        onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="שם סוג המשימה"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">אייקון</label>
        <div className="flex flex-wrap gap-2">
          {icons.map(icon => (
            <button
              key={icon}
              onClick={() => setForm(f => ({ ...f, icon }))}
              className={`w-10 h-10 rounded-lg text-xl ${
                form.icon === icon 
                  ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="זמן ברירת מחדל (דקות)"
        type="number"
        value={form.defaultDuration}
        onChange={(e) => setForm(f => ({ ...f, defaultDuration: parseInt(e.target.value) || 30 }))}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">יחס זמן</label>
        <p className="text-xs text-gray-500 mb-2">אם תמלול לוקח 3.5x מהקלטה, הזן 3.5</p>
        <input
          type="number"
          step="0.1"
          value={form.timeRatio}
          onChange={(e) => setForm(f => ({ ...f, timeRatio: parseFloat(e.target.value) || 1 }))}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={() => onSave(form)} disabled={!form.name}>שמור</Button>
        <Button variant="secondary" onClick={onCancel}>ביטול</Button>
      </div>
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

