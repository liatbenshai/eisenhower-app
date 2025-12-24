import { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * הגדרות התראות
 */
function NotificationSettings() {
  const { 
    settings, 
    permission, 
    isSupported, 
    requestPermission, 
    saveSettings 
  } = useNotifications();
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  // שינוי הגדרה
  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  // שמירת הגדרות
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(localSettings);
      toast.success('ההגדרות נשמרו');
    } catch (err) {
      toast.error('שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  };

  // בקשת הרשאה
  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('הרשאה להתראות אושרה');
      handleChange('pushEnabled', true);
    } else {
      toast.error('הרשאה להתראות נדחתה');
    }
  };

  // אפשרויות זמן תזכורת
  const reminderOptions = [
    { value: 15, label: '15 דקות לפני' },
    { value: 30, label: '30 דקות לפני' },
    { value: 60, label: 'שעה לפני' },
    { value: 1440, label: 'יום לפני' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות התראות</h2>

      {/* התראות Push */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">התראות דפדפן</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              קבל התראות על משימות בדפדפן
            </p>
          </div>
          
          {!isSupported ? (
            <span className="text-sm text-gray-500">לא נתמך</span>
          ) : permission !== 'granted' ? (
            <Button size="sm" onClick={handleRequestPermission}>
              אפשר התראות
            </Button>
          ) : (
            <button
              onClick={() => handleChange('pushEnabled', !localSettings.pushEnabled)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                localSettings.pushEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  localSettings.pushEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          )}
        </div>

        {/* הגדרות נוספות - רק אם התראות מופעלות */}
        {localSettings.pushEnabled && permission === 'granted' && (
          <div className="mr-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                זמן תזכורת ברירת מחדל
              </label>
              <select
                value={localSettings.reminderMinutes}
                onChange={(e) => handleChange('reminderMinutes', parseInt(e.target.value))}
                className="input-field"
              >
                {reminderOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* התראות מייל */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">התראות מייל</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              קבל תזכורות במייל
            </p>
          </div>
          <button
            onClick={() => handleChange('emailEnabled', !localSettings.emailEnabled)}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              localSettings.emailEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span 
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                localSettings.emailEnabled ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* סיכום יומי */}
        {localSettings.emailEnabled && (
          <div className="mr-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  סיכום יומי בבוקר
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  קבל סיכום משימות בכל בוקר
                </p>
              </div>
              <button
                onClick={() => handleChange('dailySummaryEnabled', !localSettings.dailySummaryEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  localSettings.dailySummaryEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span 
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    localSettings.dailySummaryEnabled ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {localSettings.dailySummaryEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  שעת שליחה
                </label>
                <input
                  type="time"
                  value={localSettings.dailySummaryTime}
                  onChange={(e) => handleChange('dailySummaryTime', e.target.value)}
                  className="input-field w-32"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* כפתור שמירה */}
      <Button onClick={handleSave} loading={saving}>
        שמור הגדרות
      </Button>
    </div>
  );
}

export default NotificationSettings;

