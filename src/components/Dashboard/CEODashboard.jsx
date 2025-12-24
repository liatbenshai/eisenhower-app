import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import toast from 'react-hot-toast';

/**
 * סוגי משימות
 */
const TASK_TYPES = {
  transcription: { id: 'transcription', name: 'תמלול', icon: '🎙️', category: 'work' },
  proofreading: { id: 'proofreading', name: 'הגהה', icon: '📝', category: 'work' },
  email: { id: 'email', name: 'מיילים', icon: '📧', category: 'work' },
  course: { id: 'course', name: 'קורס התמלול', icon: '📚', category: 'venture' },
  client_communication: { id: 'client_communication', name: 'לקוחות', icon: '💬', category: 'work' },
  management: { id: 'management', name: 'ניהול', icon: '👔', category: 'work' },
  family: { id: 'family', name: 'משפחה', icon: '👨‍👩‍👧‍👦', category: 'family' },
  kids: { id: 'kids', name: 'ילדים', icon: '🧒', category: 'family' },
  personal: { id: 'personal', name: 'אישי', icon: '🧘', category: 'personal' },
  unexpected: { id: 'unexpected', name: 'בלת"מים', icon: '⚡', category: 'work' },
  other: { id: 'other', name: 'אחר', icon: '📋', category: 'work' }
};

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0 דק\'';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * פורמט תאריך עברי
 */
function formatHebrewDate(date) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const d = new Date(date);
  return `יום ${days[d.getDay()]}, ${d.toLocaleDateString('he-IL')}`;
}

/**
 * בדיקה אם היום
 */
function isToday(date) {
  const today = new Date();
  const d = new Date(date);
  return d.toDateString() === today.toDateString();
}

/**
 * דשבורד מנכ"לית
 */
function CEODashboard() {
  const { tasks, addTask, editTask, toggleComplete, removeTask, loading } = useTasks();
  const { user } = useAuth();
  
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [quickNote, setQuickNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // טעינת הערות מ-localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ceo_notes');
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // שמירת הערות
  const saveNote = () => {
    if (!quickNote.trim()) return;
    const newNotes = [...notes, { 
      id: Date.now(), 
      text: quickNote.trim(), 
      date: new Date().toISOString() 
    }];
    setNotes(newNotes);
    localStorage.setItem('ceo_notes', JSON.stringify(newNotes));
    setQuickNote('');
    toast.success('הערה נשמרה');
  };

  // מחיקת הערה
  const deleteNote = (id) => {
    const newNotes = notes.filter(n => n.id !== id);
    setNotes(newNotes);
    localStorage.setItem('ceo_notes', JSON.stringify(newNotes));
  };

  // תאריך היום
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];

  // משימות להיום
  const todayTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.is_completed) return false;
      
      // משימה רגילה
      if (task.due_date === todayISO) return true;
      if (task.start_date === todayISO) return true;
      
      // משימה ארוכה - בין start_date ל-due_date
      if (task.start_date && task.due_date && task.start_date !== task.due_date) {
        const startDate = new Date(task.start_date);
        const dueDate = new Date(task.due_date);
        if (today >= startDate && today <= dueDate) return true;
      }
      
      // משימה בלי תאריך
      if (!task.due_date && !task.start_date) return true;
      
      return false;
    }).sort((a, b) => {
      // דחופים קודם
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });
  }, [tasks, todayISO]);

  // משימות שהושלמו היום
  const completedToday = useMemo(() => {
    return tasks.filter(task => 
      task.is_completed && 
      (task.due_date === todayISO || task.completed_at?.startsWith(todayISO))
    );
  }, [tasks, todayISO]);

  // סטטיסטיקות לפי קטגוריה
  const stats = useMemo(() => {
    const work = todayTasks.filter(t => 
      ['transcription', 'proofreading', 'email', 'client_communication', 'management', 'unexpected'].includes(t.task_type)
    );
    const venture = todayTasks.filter(t => t.task_type === 'course');
    const family = todayTasks.filter(t => ['family', 'kids'].includes(t.task_type));
    const personal = todayTasks.filter(t => t.task_type === 'personal');

    const workMinutes = work.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const ventureMinutes = venture.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const familyMinutes = family.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const personalMinutes = personal.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);

    const totalPlanned = workMinutes + ventureMinutes + familyMinutes + personalMinutes;
    const totalSpent = todayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const urgent = todayTasks.filter(t => t.priority === 'urgent');

    return {
      work: { tasks: work, minutes: workMinutes },
      venture: { tasks: venture, minutes: ventureMinutes },
      family: { tasks: family, minutes: familyMinutes },
      personal: { tasks: personal, minutes: personalMinutes },
      totalPlanned,
      totalSpent,
      urgent,
      completedCount: completedToday.length
    };
  }, [todayTasks, completedToday]);

  // המלצות חכמות
  const recommendations = useMemo(() => {
    const recs = [];

    // בדיקת עומס
    if (stats.totalPlanned > 480) {
      recs.push({
        type: 'warning',
        icon: '⚠️',
        title: 'יום עמוס מדי',
        text: `תכננת ${formatMinutes(stats.totalPlanned)} - יותר מ-8 שעות. שקלי לדחות משימות.`
      });
    }

    // בדיקת איזון
    if (stats.work.minutes > 0 && stats.family.minutes === 0) {
      recs.push({
        type: 'balance',
        icon: '👨‍👩‍👧‍👦',
        title: 'זמן משפחה',
        text: 'אין משימות משפחה היום. הקדישי זמן לילדים?'
      });
    }

    // משימות דחופות
    if (stats.urgent.length > 3) {
      recs.push({
        type: 'urgent',
        icon: '🔴',
        title: 'יותר מדי דחוף',
        text: `${stats.urgent.length} משימות דחופות - אולי לא הכל באמת דחוף?`
      });
    }

    // עידוד
    if (stats.completedCount >= 3) {
      recs.push({
        type: 'success',
        icon: '🌟',
        title: 'יופי!',
        text: `כבר סיימת ${stats.completedCount} משימות היום!`
      });
    }

    // זמן אישי
    if (stats.personal.minutes === 0 && stats.totalPlanned > 300) {
      recs.push({
        type: 'personal',
        icon: '🧘',
        title: 'זמן לעצמך',
        text: 'יום ארוך בלי זמן אישי. הפסקה קצרה?'
      });
    }

    return recs;
  }, [stats]);

  // פיצול משימה ארוכה
  const splitLongTask = async (task) => {
    if (!task.estimated_duration || task.estimated_duration <= 45) return;

    const chunks = Math.ceil(task.estimated_duration / 45);
    const chunkDuration = Math.ceil(task.estimated_duration / chunks);

    // יצירת תת-משימות
    for (let i = 0; i < chunks; i++) {
      const isLast = i === chunks - 1;
      const duration = isLast 
        ? task.estimated_duration - (chunkDuration * (chunks - 1))
        : chunkDuration;

      await addTask({
        title: `${task.title} (חלק ${i + 1}/${chunks})`,
        description: task.description,
        taskType: task.task_type,
        estimatedDuration: duration,
        startDate: task.start_date || task.due_date,
        dueDate: task.due_date,
        priority: task.priority
      });
    }

    // מחיקת המשימה המקורית
    await removeTask(task.id);
    toast.success(`המשימה פוצלה ל-${chunks} חלקים של ${chunkDuration} דקות`);
  };

  // הוספת משימה מהירה
  const handleQuickAdd = async (category) => {
    const typeMap = {
      work: 'management',
      venture: 'course',
      family: 'family',
      personal: 'personal'
    };
    setEditingTask({ task_type: typeMap[category] });
    setShowTaskForm(true);
  };

  // שעה נוכחית
  const currentHour = today.getHours();
  const greeting = currentHour < 12 ? 'בוקר טוב' : currentHour < 17 ? 'צהריים טובים' : 'ערב טוב';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        
        {/* כותרת */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {greeting}, ליאת 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {formatHebrewDate(today)}
          </p>
        </motion.div>

        {/* סיכום מהיר */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {/* עבודה */}
          <div 
            onClick={() => handleQuickAdd('work')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💼</span>
              <span className="text-xs text-gray-500">+ הוסף</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.work.tasks.length}
            </div>
            <div className="text-sm text-gray-500">משימות עבודה</div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {formatMinutes(stats.work.minutes)}
            </div>
          </div>

          {/* יזמות */}
          <div 
            onClick={() => handleQuickAdd('venture')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🚀</span>
              <span className="text-xs text-gray-500">+ הוסף</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.venture.tasks.length}
            </div>
            <div className="text-sm text-gray-500">קורס התמלול</div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {formatMinutes(stats.venture.minutes)}
            </div>
          </div>

          {/* משפחה */}
          <div 
            onClick={() => handleQuickAdd('family')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">👨‍👩‍👧‍👦</span>
              <span className="text-xs text-gray-500">+ הוסף</span>
            </div>
            <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
              {stats.family.tasks.length}
            </div>
            <div className="text-sm text-gray-500">משפחה</div>
            <div className="text-xs text-pink-600 dark:text-pink-400 mt-1">
              {formatMinutes(stats.family.minutes)}
            </div>
          </div>

          {/* אישי */}
          <div 
            onClick={() => handleQuickAdd('personal')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🧘</span>
              <span className="text-xs text-gray-500">+ הוסף</span>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.personal.tasks.length}
            </div>
            <div className="text-sm text-gray-500">זמן אישי</div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {formatMinutes(stats.personal.minutes)}
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* עמודה ראשית - משימות */}
          <div className="md:col-span-2 space-y-6">
            
            {/* משימות דחופות */}
            {stats.urgent.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800"
              >
                <h2 className="font-bold text-red-700 dark:text-red-300 mb-3 flex items-center gap-2">
                  🔴 דורש טיפול מיידי ({stats.urgent.length})
                </h2>
                <div className="space-y-2">
                  {stats.urgent.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onEdit={() => { setEditingTask(task); setShowTaskForm(true); }}
                      onComplete={() => toggleComplete(task.id)}
                      onSplit={() => splitLongTask(task)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* כל המשימות להיום */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  📋 המשימות שלי להיום
                  <span className="text-sm font-normal text-gray-500">
                    ({todayTasks.length})
                  </span>
                </h2>
                <Button 
                  onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                  className="text-sm"
                >
                  + משימה חדשה
                </Button>
              </div>

              {todayTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl block mb-2">🎉</span>
                  אין משימות להיום! הוסיפי משימה או תהני מהיום הפנוי
                </div>
              ) : (
                <div className="space-y-2">
                  {(showAllTasks ? todayTasks : todayTasks.slice(0, 5)).map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onEdit={() => { setEditingTask(task); setShowTaskForm(true); }}
                      onComplete={() => toggleComplete(task.id)}
                      onSplit={() => splitLongTask(task)}
                    />
                  ))}
                  {todayTasks.length > 5 && (
                    <button
                      onClick={() => setShowAllTasks(!showAllTasks)}
                      className="w-full py-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
                    >
                      {showAllTasks ? 'הצג פחות' : `עוד ${todayTasks.length - 5} משימות...`}
                    </button>
                  )}
                </div>
              )}

              {/* סיכום זמן */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">סה"כ מתוכנן:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatMinutes(stats.totalPlanned)}
                  </span>
                </div>
                {stats.totalSpent > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-500">כבר עבדת:</span>
                    <span className="font-medium text-green-600">
                      {formatMinutes(stats.totalSpent)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* משימות שהושלמו */}
            {completedToday.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800"
              >
                <h2 className="font-bold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                  ✅ הושלמו היום ({completedToday.length})
                </h2>
                <div className="text-sm text-green-600 dark:text-green-400">
                  {completedToday.map(t => t.title).join(' • ')}
                </div>
              </motion.div>
            )}
          </div>

          {/* עמודה צדדית */}
          <div className="space-y-6">
            
            {/* המלצות */}
            {recommendations.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <h2 className="font-bold text-gray-900 dark:text-white mb-3">
                  💡 המלצות
                </h2>
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div 
                      key={i}
                      className={`p-3 rounded-lg text-sm ${
                        rec.type === 'warning' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' :
                        rec.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                        rec.type === 'urgent' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                        'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      <div className="font-medium">{rec.icon} {rec.title}</div>
                      <div className="text-xs mt-1 opacity-80">{rec.text}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* הערות מהירות */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <h2 className="font-bold text-gray-900 dark:text-white mb-3">
                📝 הערות מהירות
              </h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveNote()}
                  placeholder="רשמי משהו..."
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={saveNote}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                >
                  +
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notes.slice().reverse().map(note => (
                  <div 
                    key={note.id}
                    className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm group"
                  >
                    <span className="flex-1 text-gray-700 dark:text-gray-300">{note.text}</span>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* סרגל איזון */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <h2 className="font-bold text-gray-900 dark:text-white mb-3">
                ⚖️ איזון היום
              </h2>
              <div className="space-y-3">
                <BalanceBar 
                  label="עבודה" 
                  value={stats.work.minutes} 
                  max={stats.totalPlanned || 1}
                  color="blue"
                />
                <BalanceBar 
                  label="יזמות" 
                  value={stats.venture.minutes} 
                  max={stats.totalPlanned || 1}
                  color="purple"
                />
                <BalanceBar 
                  label="משפחה" 
                  value={stats.family.minutes} 
                  max={stats.totalPlanned || 1}
                  color="pink"
                />
                <BalanceBar 
                  label="אישי" 
                  value={stats.personal.minutes} 
                  max={stats.totalPlanned || 1}
                  color="green"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* מודל טופס */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        title={editingTask?.id ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          task={editingTask}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
          taskTypes={TASK_TYPES}
          defaultDate={todayISO}
        />
      </Modal>
    </div>
  );
}

/**
 * כרטיס משימה
 */
function TaskCard({ task, onEdit, onComplete, onSplit }) {
  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
  const isLongTask = task.estimated_duration > 45;
  const spent = task.time_spent || 0;
  const estimated = task.estimated_duration || 0;
  const remaining = Math.max(0, estimated - spent);
  const progress = estimated > 0 ? Math.min(100, Math.round((spent / estimated) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      {/* סימון */}
      <button
        onClick={onComplete}
        className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-500 hover:border-green-500 hover:bg-green-500 flex-shrink-0 transition-all flex items-center justify-center group"
      >
        <span className="text-white text-xs opacity-0 group-hover:opacity-100">✓</span>
      </button>

      {/* אייקון */}
      <span className="text-lg">{taskType.icon}</span>

      {/* תוכן */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {task.title}
          </span>
          {task.priority === 'urgent' && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded">
              דחוף
            </span>
          )}
          {isLongTask && (
            <button
              onClick={onSplit}
              className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded hover:bg-purple-200"
              title="פצל למקטעים"
            >
              ✂️ פצל
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{formatMinutes(estimated)}</span>
          {spent > 0 && (
            <>
              <span>•</span>
              <span className="text-blue-600">נותרו {formatMinutes(remaining)}</span>
            </>
          )}
          {progress > 0 && (
            <div className="flex-1 max-w-20 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* עריכה */}
      <button
        onClick={onEdit}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
      >
        ✏️
      </button>
    </div>
  );
}

/**
 * סרגל איזון
 */
function BalanceBar({ label, value, max, color }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const colorClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
    green: 'bg-green-500'
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-gray-900 dark:text-white font-medium">{percent}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default CEODashboard;
