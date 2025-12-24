import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

/**
 * סוגי הפרעות
 */
const INTERRUPTION_TYPES = {
  client_call: { 
    id: 'client_call', 
    name: 'שיחת לקוח', 
    icon: '📞',
    color: 'blue'
  },
  phone_call: { 
    id: 'phone_call', 
    name: 'שיחת טלפון אחרת', 
    icon: '📱',
    color: 'green'
  },
  meeting: { 
    id: 'meeting', 
    name: 'פגישה לא מתוכננת', 
    icon: '👥',
    color: 'purple'
  },
  distraction: { 
    id: 'distraction', 
    name: 'הסחת דעת', 
    icon: '🎯',
    color: 'orange'
  },
  break: { 
    id: 'break', 
    name: 'הפסקה', 
    icon: '☕',
    color: 'yellow'
  },
  technical: { 
    id: 'technical', 
    name: 'בעיה טכנית', 
    icon: '🔧',
    color: 'red'
  },
  urgent_task: { 
    id: 'urgent_task', 
    name: 'משימה דחופה', 
    icon: '🚨',
    color: 'red'
  },
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '❓',
    color: 'gray'
  }
};

/**
 * מעקב הפרעות
 * מאפשר לתעד הפרעות ולראות סטטיסטיקות
 */
function InterruptionsTracker() {
  const { user } = useAuth();
  const [interruptions, setInterruptions] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentInterruption, setCurrentInterruption] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInterruption, setNewInterruption] = useState({
    type: 'client_call',
    description: '',
    duration: ''
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('today'); // today, week, all

  // טעינת הפרעות מה-DB
  useEffect(() => {
    if (user?.id) {
      loadInterruptions();
    }
  }, [user?.id]);

  // טיימר להפרעה נוכחית
  useEffect(() => {
    let interval;
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, startTime]);

  // טעינת הפרעות
  const loadInterruptions = async () => {
    try {
      // נשתמש ב-localStorage עד שניצור טבלה
      const stored = localStorage.getItem(`interruptions_${user.id}`);
      if (stored) {
        setInterruptions(JSON.parse(stored));
      }
    } catch (err) {
      console.error('שגיאה בטעינת הפרעות:', err);
    } finally {
      setLoading(false);
    }
  };

  // שמירת הפרעות
  const saveInterruptions = (newList) => {
    localStorage.setItem(`interruptions_${user.id}`, JSON.stringify(newList));
    setInterruptions(newList);
  };

  // התחלת מעקב הפרעה
  const startInterruptionTracking = (type) => {
    setCurrentInterruption(type);
    setStartTime(new Date());
    setIsTracking(true);
    setElapsedSeconds(0);
    toast.success(`⏱️ התחלת מעקב: ${INTERRUPTION_TYPES[type].name}`);
  };

  // סיום מעקב הפרעה
  const stopInterruptionTracking = (description = '') => {
    if (!isTracking || !currentInterruption) return;

    const duration = Math.ceil(elapsedSeconds / 60); // בדקות
    const newInterruptionRecord = {
      id: Date.now().toString(),
      type: currentInterruption,
      description,
      duration,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };

    const newList = [newInterruptionRecord, ...interruptions];
    saveInterruptions(newList);

    setIsTracking(false);
    setCurrentInterruption(null);
    setStartTime(null);
    setElapsedSeconds(0);

    toast.success(`✅ נשמר: ${duration} דקות של ${INTERRUPTION_TYPES[newInterruptionRecord.type].name}`);
  };

  // הוספת הפרעה ידנית
  const addManualInterruption = () => {
    if (!newInterruption.duration || parseInt(newInterruption.duration) <= 0) {
      toast.error('נא להזין זמן תקין');
      return;
    }

    const record = {
      id: Date.now().toString(),
      type: newInterruption.type,
      description: newInterruption.description,
      duration: parseInt(newInterruption.duration),
      date: new Date().toISOString().split('T')[0],
      manual: true
    };

    const newList = [record, ...interruptions];
    saveInterruptions(newList);

    setNewInterruption({ type: 'client_call', description: '', duration: '' });
    setShowAddForm(false);
    toast.success('✅ הפרעה נוספה');
  };

  // מחיקת הפרעה
  const deleteInterruption = (id) => {
    const newList = interruptions.filter(i => i.id !== id);
    saveInterruptions(newList);
    toast.success('🗑️ נמחק');
  };

  // סינון לפי תקופה
  const filteredInterruptions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().split('T')[0];

    switch (viewMode) {
      case 'today':
        return interruptions.filter(i => i.date === today);
      case 'week':
        return interruptions.filter(i => i.date >= weekAgoISO);
      default:
        return interruptions;
    }
  }, [interruptions, viewMode]);

  // סטטיסטיקות
  const stats = useMemo(() => {
    const totalTime = filteredInterruptions.reduce((sum, i) => sum + (i.duration || 0), 0);
    const byType = {};
    
    filteredInterruptions.forEach(i => {
      if (!byType[i.type]) {
        byType[i.type] = { count: 0, totalTime: 0 };
      }
      byType[i.type].count++;
      byType[i.type].totalTime += i.duration || 0;
    });

    // מציאת הסוג הכי נפוץ
    let mostCommon = null;
    let maxCount = 0;
    Object.entries(byType).forEach(([type, data]) => {
      if (data.count > maxCount) {
        maxCount = data.count;
        mostCommon = type;
      }
    });

    return {
      total: filteredInterruptions.length,
      totalTime,
      byType,
      mostCommon,
      averageTime: filteredInterruptions.length > 0 
        ? Math.round(totalTime / filteredInterruptions.length) 
        : 0
    };
  }, [filteredInterruptions]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const formatSeconds = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* מעקב הפרעה פעיל */}
      <AnimatePresence>
        {isTracking && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card p-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl animate-pulse">
                  {INTERRUPTION_TYPES[currentInterruption]?.icon}
                </span>
                <div>
                  <div className="font-bold text-red-700 dark:text-red-300">
                    {INTERRUPTION_TYPES[currentInterruption]?.name}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    הפרעה פעילה
                  </div>
                </div>
              </div>
              <div className="text-4xl font-mono font-bold text-red-600 dark:text-red-400">
                {formatSeconds(elapsedSeconds)}
              </div>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="תיאור (אופציונלי)..."
                className="flex-1 px-3 py-2 rounded-lg border border-red-200 dark:border-red-700 bg-white dark:bg-gray-800"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    stopInterruptionTracking(e.target.value);
                  }
                }}
                id="interruption-description"
              />
              <Button
                onClick={() => {
                  const desc = document.getElementById('interruption-description')?.value || '';
                  stopInterruptionTracking(desc);
                }}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                ⏹️ סיים
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* כפתורי התחלת הפרעה */}
      {!isTracking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            ⏸️ התחל מעקב הפרעה
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.values(INTERRUPTION_TYPES).map(type => (
              <button
                key={type.id}
                onClick={() => startInterruptionTracking(type.id)}
                className={`p-4 rounded-lg border-2 hover:shadow-md transition-all text-center
                  ${type.color === 'blue' ? 'border-blue-200 hover:border-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''}
                  ${type.color === 'green' ? 'border-green-200 hover:border-green-400 bg-green-50 dark:bg-green-900/20' : ''}
                  ${type.color === 'purple' ? 'border-purple-200 hover:border-purple-400 bg-purple-50 dark:bg-purple-900/20' : ''}
                  ${type.color === 'orange' ? 'border-orange-200 hover:border-orange-400 bg-orange-50 dark:bg-orange-900/20' : ''}
                  ${type.color === 'yellow' ? 'border-yellow-200 hover:border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : ''}
                  ${type.color === 'red' ? 'border-red-200 hover:border-red-400 bg-red-50 dark:bg-red-900/20' : ''}
                  ${type.color === 'gray' ? 'border-gray-200 hover:border-gray-400 bg-gray-50 dark:bg-gray-700' : ''}
                `}
              >
                <div className="text-2xl mb-1">{type.icon}</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{type.name}</div>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ➕ הוסף הפרעה ידנית
          </button>

          {/* טופס הוספה ידנית */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={newInterruption.type}
                    onChange={(e) => setNewInterruption({ ...newInterruption, type: e.target.value })}
                    className="px-3 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  >
                    {Object.values(INTERRUPTION_TYPES).map(type => (
                      <option key={type.id} value={type.id}>
                        {type.icon} {type.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="משך (דקות)"
                    value={newInterruption.duration}
                    onChange={(e) => setNewInterruption({ ...newInterruption, duration: e.target.value })}
                    className="px-3 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    placeholder="תיאור (אופציונלי)"
                    value={newInterruption.description}
                    onChange={(e) => setNewInterruption({ ...newInterruption, description: e.target.value })}
                    className="px-3 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button onClick={addManualInterruption} className="bg-green-500 hover:bg-green-600 text-white">
                    ✅ הוסף
                  </Button>
                  <Button onClick={() => setShowAddForm(false)} variant="secondary">
                    ביטול
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* סטטיסטיקות */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">📊 סטטיסטיקות הפרעות</h3>
          <div className="flex gap-2">
            {['today', 'week', 'all'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  viewMode === mode
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {mode === 'today' ? 'היום' : mode === 'week' ? 'שבוע' : 'הכל'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-xs text-blue-700 dark:text-blue-300">סה"כ הפרעות</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatTime(stats.totalTime)}</div>
            <div className="text-xs text-red-700 dark:text-red-300">זמן שאבד</div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.averageTime} דק'</div>
            <div className="text-xs text-orange-700 dark:text-orange-300">ממוצע להפרעה</div>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.mostCommon ? INTERRUPTION_TYPES[stats.mostCommon]?.icon : '-'}
            </div>
            <div className="text-xs text-purple-700 dark:text-purple-300">
              {stats.mostCommon ? INTERRUPTION_TYPES[stats.mostCommon]?.name : 'אין נתונים'}
            </div>
          </div>
        </div>

        {/* התפלגות לפי סוג */}
        {Object.keys(stats.byType).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">לפי סוג</h4>
            {Object.entries(stats.byType)
              .sort((a, b) => b[1].totalTime - a[1].totalTime)
              .map(([type, data]) => {
                const typeInfo = INTERRUPTION_TYPES[type] || { icon: '❓', name: type };
                const percentage = stats.totalTime > 0 
                  ? Math.round((data.totalTime / stats.totalTime) * 100) 
                  : 0;
                
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center">{typeInfo.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-300">{typeInfo.name}</span>
                        <span className="text-gray-500">{data.count}x • {formatTime(data.totalTime)}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* רשימת הפרעות אחרונות */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📝 הפרעות אחרונות</h3>
        
        {filteredInterruptions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl block mb-2">🎯</span>
            אין הפרעות בתקופה זו - כל הכבוד!
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredInterruptions.slice(0, 10).map(interruption => {
              const typeInfo = INTERRUPTION_TYPES[interruption.type] || { icon: '❓', name: interruption.type };
              return (
                <div 
                  key={interruption.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{typeInfo.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{typeInfo.name}</div>
                      {interruption.description && (
                        <div className="text-xs text-gray-500">{interruption.description}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        {new Date(interruption.date).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      {interruption.duration} דק'
                    </span>
                    <button
                      onClick={() => deleteInterruption(interruption.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default InterruptionsTracker;
