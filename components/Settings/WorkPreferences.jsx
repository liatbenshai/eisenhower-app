import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * הגדרות עבודה - בופר וזמני אנרגיה
 */
function WorkPreferences({ onClose, onSaved }) {
  const { user } = useAuth();
  
  const [preferences, setPreferences] = useState({
    bufferMinutes: 15, // דקות בופר בין משימות
    workStartHour: 8,
    workEndHour: 16,
    highEnergyStart: 8,
    highEnergyEnd: 11,
    maxBlockSize: 60,
    preferredBlockSize: 45
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // טעינת ההעדפות
  useEffect(() => {
    if (user?.id) {
      loadPreferences();
    }
  }, [user?.id]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_work_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setPreferences({
          bufferMinutes: data.buffer_minutes ?? 15,
          workStartHour: data.work_start_hour ?? 8,
          workEndHour: data.work_end_hour ?? 16,
          highEnergyStart: data.high_energy_start ?? 8,
          highEnergyEnd: data.high_energy_end ?? 11,
          maxBlockSize: data.max_block_size ?? 60,
          preferredBlockSize: data.preferred_block_size ?? 45
        });
      }
    } catch (err) {
      console.error('שגיאה בטעינת העדפות:', err);
    } finally {
      setLoading(false);
    }
  };

  // שמירת ההעדפות
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_work_preferences')
        .upsert({
          user_id: user.id,
          buffer_minutes: preferences.bufferMinutes,
          work_start_hour: preferences.workStartHour,
          work_end_hour: preferences.workEndHour,
          high_energy_start: preferences.highEnergyStart,
          high_energy_end: preferences.highEnergyEnd,
          max_block_size: preferences.maxBlockSize,
          preferred_block_size: preferences.preferredBlockSize,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('ההעדפות נשמרו!');
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה בשמירת העדפות:', err);
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  // עדכון שדה
  const updatePref = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin text-3xl">⏳</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* בופר בין משימות */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">⏸️</span>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">זמן בופר בין משימות</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">לדברים שצצים בין לבין</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="30"
            step="5"
            value={preferences.bufferMinutes}
            onChange={(e) => updatePref('bufferMinutes', parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="w-16 text-center font-bold text-blue-600 dark:text-blue-400">
            {preferences.bufferMinutes} דק'
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>ללא בופר</span>
          <span>30 דק'</span>
        </div>
      </motion.div>

      {/* שעות עבודה */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🕐</span>
          <h3 className="font-medium text-gray-900 dark:text-white">שעות עבודה</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">התחלה</label>
            <select
              value={preferences.workStartHour}
              onChange={(e) => updatePref('workStartHour', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[6, 7, 8, 9, 10].map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">סיום</label>
            <select
              value={preferences.workEndHour}
              onChange={(e) => updatePref('workEndHour', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[14, 15, 16, 17, 18, 19, 20].map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* שעות אנרגיה גבוהה */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔋</span>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">שעות אנרגיה גבוהה</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">מתי את הכי יעילה? (לעבודות קשות)</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">מ-</label>
            <select
              value={preferences.highEnergyStart}
              onChange={(e) => updatePref('highEnergyStart', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[6, 7, 8, 9, 10, 11, 12, 13, 14].map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">עד-</label>
            <select
              value={preferences.highEnergyEnd}
              onChange={(e) => updatePref('highEnergyEnd', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* גודל בלוקים */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">📦</span>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">גודל בלוקים מועדף</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">כמה זמן רצוף את יכולה לעבוד</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {[30, 45, 60, 90].map(size => (
            <button
              key={size}
              onClick={() => updatePref('preferredBlockSize', size)}
              className={`
                flex-1 py-2 rounded-lg font-medium transition-all
                ${preferences.preferredBlockSize === size
                  ? 'bg-purple-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                }
              `}
            >
              {size < 60 ? `${size} דק'` : `${size / 60}h`}
            </button>
          ))}
        </div>
      </motion.div>

      {/* סיכום ויזואלי */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4"
      >
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📅 איך יום עבודה ייראה:</h4>
        <div className="flex items-center text-sm">
          <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-blue-800 dark:text-blue-200">
            {preferences.workStartHour}:00
          </span>
          <span className="flex-1 h-2 mx-2 bg-gradient-to-r from-yellow-400 via-blue-400 to-blue-200 rounded relative">
            <span 
              className="absolute top-0 h-full bg-yellow-400 rounded-r"
              style={{ 
                left: 0,
                width: `${((preferences.highEnergyEnd - preferences.highEnergyStart) / (preferences.workEndHour - preferences.workStartHour)) * 100}%`
              }}
            />
          </span>
          <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-gray-800 dark:text-gray-200">
            {preferences.workEndHour}:00
          </span>
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>🔋 אנרגיה גבוהה: {preferences.highEnergyStart}:00-{preferences.highEnergyEnd}:00</span>
          <span>⏸️ בופר: {preferences.bufferMinutes} דק'</span>
        </div>
      </motion.div>

      {/* כפתורים */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          ביטול
        </Button>
        <Button onClick={handleSave} loading={saving} className="flex-1">
          💾 שמור
        </Button>
      </div>
    </div>
  );
}

export default WorkPreferences;
