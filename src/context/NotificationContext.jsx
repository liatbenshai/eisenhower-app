import { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { 
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  scheduleNotification,
  cancelScheduledNotification
} from '../services/pushNotifications';

// יצירת קונטקסט
export const NotificationContext = createContext(null);

// הגדרות ברירת מחדל
const DEFAULT_SETTINGS = {
  pushEnabled: false,
  emailEnabled: false,
  reminderMinutes: 15,
  dailySummaryEnabled: false,
  dailySummaryTime: '08:00'
};

/**
 * ספק התראות
 */
export function NotificationProvider({ children }) {
  console.log('🔔 NotificationProvider rendering...');
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState('default');
  const [scheduledNotifications, setScheduledNotifications] = useState({});

  // בדיקת הרשאות בעליה
  useEffect(() => {
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
  }, []);

  // טעינת הגדרות מהשרת
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (data) {
          setSettings({
            pushEnabled: data.push_enabled,
            emailEnabled: data.email_enabled,
            reminderMinutes: data.reminder_minutes,
            dailySummaryEnabled: data.daily_summary_enabled,
            dailySummaryTime: data.daily_summary_time
          });
        }
      } catch (err) {
        console.log('אין הגדרות קיימות, משתמש בברירת מחדל');
      }
    };

    loadSettings();
  }, [user?.id]);

  // בקשת הרשאה להתראות
  const requestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    return granted;
  };

  // שמירת הגדרות
  const saveSettings = async (newSettings) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          push_enabled: newSettings.pushEnabled,
          email_enabled: newSettings.emailEnabled,
          reminder_minutes: newSettings.reminderMinutes,
          daily_summary_enabled: newSettings.dailySummaryEnabled,
          daily_summary_time: newSettings.dailySummaryTime,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('שגיאה בשמירת הגדרות:', err);
      throw new Error('שגיאה בשמירת הגדרות');
    }
  };

  // תזמון התראה למשימה
  const scheduleTaskNotification = useCallback((task) => {
    if (!settings.pushEnabled || permission !== 'granted') return;
    if (!task.due_date || !task.reminder_minutes) return;

    // ביטול התראה קיימת אם יש
    if (scheduledNotifications[task.id]) {
      cancelScheduledNotification(scheduledNotifications[task.id]);
    }

    // תזמון התראה חדשה
    const timeoutId = scheduleNotification(task, task.reminder_minutes);
    
    if (timeoutId) {
      setScheduledNotifications(prev => ({
        ...prev,
        [task.id]: timeoutId
      }));
    }
  }, [settings.pushEnabled, permission, scheduledNotifications]);

  // ביטול התראה למשימה
  const cancelTaskNotification = useCallback((taskId) => {
    if (scheduledNotifications[taskId]) {
      cancelScheduledNotification(scheduledNotifications[taskId]);
      setScheduledNotifications(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }, [scheduledNotifications]);

  // ביטול כל ההתראות
  const cancelAllNotifications = useCallback(() => {
    Object.values(scheduledNotifications).forEach(timeoutId => {
      cancelScheduledNotification(timeoutId);
    });
    setScheduledNotifications({});
  }, [scheduledNotifications]);

  const value = {
    settings,
    permission,
    isSupported: isNotificationSupported(),
    requestPermission,
    saveSettings,
    scheduleTaskNotification,
    cancelTaskNotification,
    cancelAllNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;

