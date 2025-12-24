import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { TASK_CATEGORIES } from '../../utils/taskCategories';
import { getUserTaskTypeStats } from '../../utils/taskTypeLearning';
import { supabase } from '../../services/supabase';
import Button from '../UI/Button';
import Input from '../UI/Input';
import toast from 'react-hot-toast';

/**
 * ניהול כללי תיקון זמן
 * מאפשר למשתמש להגדיר שמשימות מסוג מסוים תמיד לוקחות יותר זמן
 */
function TimeCorrectionRules() {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadRules();
      loadStats();
    }
  }, [user?.id]);

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from('time_correction_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('task_type');

      if (error) throw error;
      setRules(data || []);
    } catch (err) {
      console.error('שגיאה בטעינת כללים:', err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getUserTaskTypeStats(user.id);
      setStats(data);
    } catch (err) {
      console.error('שגיאה בטעינת סטטיסטיקות:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (taskType, multiplier, notes) => {
    if (!taskType || !multiplier) {
      toast.error('חובה למלא סוג משימה ומקדם');
      return;
    }

    if (multiplier < 0.1 || multiplier > 10) {
      toast.error('המקדם חייב להיות בין 0.1 ל-10');
      return;
    }

    try {
      const ruleData = {
        user_id: user.id,
        task_type: taskType,
        time_multiplier: parseFloat(multiplier),
        notes: notes || null,
        is_active: true,
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('time_correction_rules')
        .upsert(ruleData, {
          onConflict: 'user_id,task_type'
        });

      if (error) throw error;

      toast.success('כלל נשמר בהצלחה');
      setEditingRule(null);
      loadRules();
    } catch (err) {
      console.error('שגיאה בשמירת כלל:', err);
      toast.error('שגיאה בשמירת כלל');
    }
  };

  const handleDeleteRule = async (taskType) => {
    if (!confirm('האם למחוק את הכלל?')) return;

    try {
      const { error } = await supabase
        .from('time_correction_rules')
        .delete()
        .eq('user_id', user.id)
        .eq('task_type', taskType);

      if (error) throw error;

      toast.success('כלל נמחק');
      loadRules();
    } catch (err) {
      console.error('שגיאה במחיקת כלל:', err);
      toast.error('שגיאה במחיקת כלל');
    }
  };

  const getStatsForType = (taskType) => {
    return stats.find(s => s.task_type === taskType);
  };

  const getCategoryName = (taskType) => {
    const category = Object.values(TASK_CATEGORIES).find(cat => cat.id === taskType);
    return category ? category.name : taskType;
  };

  const getCategoryIcon = (taskType) => {
    const category = Object.values(TASK_CATEGORIES).find(cat => cat.id === taskType);
    return category ? category.icon : '📋';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p className="mt-2 text-gray-500 dark:text-gray-400">טוען כללים...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* כותרת */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          כללי תיקון זמן 🎯
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          הגדירי כללים שיעזרו לך להעריך זמן נכון יותר
        </p>
      </div>

      {/* הסבר */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              איך זה עובד?
            </p>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>✅ <strong>הגדירי כלל:</strong> "תמלול לוקח לי פי 3 ממה שאני חושבת"</p>
              <p>✅ <strong>המערכת תציע:</strong> כשתכתבי 30 דקות, היא תציע 90 דקות</p>
              <p>✅ <strong>למידה אוטומטית:</strong> המערכת תתקן את המקדם לפי התוצאות בפועל</p>
            </div>
          </div>
        </div>
      </div>

      {/* כללים קיימים */}
      {rules.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            הכללים שלך
          </h3>
          {rules.map(rule => {
            const typeStats = getStatsForType(rule.task_type);
            return (
              <div
                key={rule.task_type}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getCategoryIcon(rule.task_type)}</span>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        {getCategoryName(rule.task_type)}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        rule.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {rule.is_active ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">מקדם תיקון:</span>
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          × {rule.time_multiplier}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          (אם את אומרת 30 דקות, המערכת תציע {Math.round(30 * rule.time_multiplier)} דקות)
                        </span>
                      </div>

                      {rule.notes && (
                        <div className="text-gray-600 dark:text-gray-400">
                          📝 {rule.notes}
                        </div>
                      )}

                      {typeStats && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            📊 נתונים בפועל:
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">משימות:</span>
                              <span className="font-medium text-gray-900 dark:text-white ml-1">
                                {typeStats.completed_tasks}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">ממוצע זמן:</span>
                              <span className="font-medium text-gray-900 dark:text-white ml-1">
                                {typeStats.average_time} דקות
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">דיוק:</span>
                              <span className={`font-medium ml-1 ${
                                typeStats.average_accuracy_percentage >= 80
                                  ? 'text-green-600 dark:text-green-400'
                                  : typeStats.average_accuracy_percentage >= 60
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {typeStats.average_accuracy_percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="text-sm px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.task_type)}
                      className="text-sm px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      מחק
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* טופס הוספה/עריכה */}
      <RuleForm
        rule={editingRule}
        onSave={handleSaveRule}
        onCancel={() => setEditingRule(null)}
      />

      {/* המלצות */}
      {stats.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700 p-4">
          <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">
            💡 המלצות לכללים
          </h3>
          <div className="space-y-2 text-sm">
            {stats
              .filter(s => s.completed_tasks >= 3 && s.average_accuracy_percentage < 70)
              .slice(0, 3)
              .map(s => {
                const category = Object.values(TASK_CATEGORIES).find(cat => cat.id === s.task_type);
                const suggestedMultiplier = s.average_time / (s.average_time * (s.average_accuracy_percentage / 100));
                const hasRule = rules.find(r => r.task_type === s.task_type);

                if (hasRule) return null;

                return (
                  <div key={s.task_type} className="bg-white dark:bg-gray-800 rounded p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{category?.icon || '📋'}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {category?.name || s.task_type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          הדיוק שלך: {s.average_accuracy_percentage}% - כדאי להגדיר מקדם × {suggestedMultiplier.toFixed(1)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingRule({
                          task_type: s.task_type,
                          time_multiplier: suggestedMultiplier,
                          is_active: true
                        })}
                      >
                        הוסף
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * טופס הוספה/עריכה של כלל
 */
function RuleForm({ rule, onSave, onCancel }) {
  const [taskType, setTaskType] = useState(rule?.task_type || '');
  const [multiplier, setMultiplier] = useState(rule?.time_multiplier || 1);
  const [notes, setNotes] = useState(rule?.notes || '');

  useEffect(() => {
    if (rule) {
      setTaskType(rule.task_type);
      setMultiplier(rule.time_multiplier);
      setNotes(rule.notes || '');
    }
  }, [rule]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(taskType, multiplier, notes);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {rule ? 'עריכת כלל' : 'הוספת כלל חדש'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            סוג משימה
          </label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="input-field"
            required
          >
            <option value="">בחרי סוג משימה</option>
            {Object.values(TASK_CATEGORIES).map(category => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            מקדם תיקון (× {multiplier})
          </label>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={multiplier}
            onChange={(e) => setMultiplier(parseFloat(e.target.value))}
            className="input-field"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            דוגמה: אם תגדירי 30 דקות, המערכת תציע {Math.round(30 * multiplier)} דקות
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            הערות (אופציונלי)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input-field resize-none"
            placeholder="למשל: 'תמלול תמיד לוקח לי יותר זמן כי אני מוסחת'"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" fullWidth>
            {rule ? 'עדכן כלל' : 'הוסף כלל'}
          </Button>
          {rule && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              ביטול
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default TimeCorrectionRules;

