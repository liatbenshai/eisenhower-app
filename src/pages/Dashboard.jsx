import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../hooks/useTasks';
import TaskForm from '../components/Tasks/TaskForm';
import ProjectTaskForm from '../components/Tasks/ProjectTaskForm';
import TaskFilters from '../components/Tasks/TaskFilters';
import ExportButtons from '../components/Export/ExportButtons';
import Modal from '../components/UI/Modal';
import Button from '../components/UI/Button';
import Tabs from '../components/UI/Tabs';
import TimeAnalytics from '../components/Analytics/TimeAnalytics';
import PlanningVsExecution from '../components/Planning/PlanningVsExecution';
import ManualTimeUpdate from '../components/Tasks/ManualTimeUpdate';
import CalendarView from '../components/Calendar/CalendarView';
import TimePlanningRecommendations from '../components/Recommendations/TimePlanningRecommendations';
import TaskList from '../components/Tasks/TaskList';

/**
 * דף לוח המחוונים הראשי
 */
function Dashboard() {
  const { loading, error, getStats, tasks, loadTasks } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDateForTask, setSelectedDateForTask] = useState(null); // תאריך נבחר להוספת משימה
  const [selectedTimeForTask, setSelectedTimeForTask] = useState(null); // שעה נבחרת להוספת משימה
  const stats = getStats();

  // פתיחת טופס הוספת משימה
  const handleAddTask = (date = null, time = null) => {
    setEditingTask(null);
    setSelectedDateForTask(date);
    setSelectedTimeForTask(time);
    setShowTaskForm(true);
    setShowProjectForm(false);
  };

  // פתיחת טופס יצירת פרויקט
  const handleAddProject = () => {
    setEditingTask(null);
    setSelectedDateForTask(null);
    setSelectedTimeForTask(null);
    setShowProjectForm(true);
    setShowTaskForm(false);
  };

  // פתיחת טופס עריכת משימה
  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
    setShowProjectForm(false);
  };

  // סגירת טופס
  const handleCloseForm = () => {
    setShowTaskForm(false);
    setShowProjectForm(false);
    setEditingTask(null);
  };

  // מסך טעינה
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">טוען משימות...</p>
        </div>
      </div>
    );
  }

  // הודעת שגיאה
  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <span className="text-4xl mb-4 block">⚠️</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">שגיאה</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* כותרת וכלים */}
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* סטטיסטיקות */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">סה"כ משימות</p>
                <p className="font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">הושלמו</p>
                <p className="font-bold text-green-600">{stats.completed}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">פעילות</p>
                <p className="font-bold text-blue-600">{stats.active}</p>
              </div>
            </div>
          </div>

          {/* כפתורים */}
          <div className="flex flex-wrap gap-3">
            <TaskFilters />
            <ExportButtons />
            <div className="flex gap-2">
              <Button onClick={() => handleAddTask(1)} variant="secondary">
                + משימה
              </Button>
              <Button onClick={() => handleAddProject(1)} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                📋 + פרויקט עם שלבים
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* לשוניות - רק מה שחשוב */}
      <Tabs
        defaultTab={0}
        tabs={[
          {
            label: 'תכנון vs ביצוע',
            icon: '📊',
            content: (
              <div className="space-y-6">
                {/* עדכון זמן ידני */}
                <ManualTimeUpdate 
                  onUpdated={loadTasks} 
                />
                <PlanningVsExecution />
              </div>
            )
          },
          {
            label: 'לוח שנה',
            icon: '📅',
            content: <CalendarView onAddTask={handleAddTask} onEditTask={handleEditTask} />
          },
          {
            label: 'ניתוח זמן',
            icon: '⏱️',
            content: <TimeAnalytics />
          },
          {
            label: 'המלצות',
            icon: '🧠',
            content: <TimePlanningRecommendations />
          },
          {
            label: 'משימות',
            icon: '📝',
            content: <TaskList onEditTask={handleEditTask} />
          }
        ]}
      />

      {/* מודל טופס משימה */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <TaskForm
          task={editingTask}
          defaultQuadrant={1}
          defaultDate={selectedDateForTask}
          defaultTime={selectedTimeForTask}
          onClose={handleCloseForm}
        />
      </Modal>

      {/* מודל טופס פרויקט */}
      <Modal
        isOpen={showProjectForm}
        onClose={handleCloseForm}
        title="פרויקט חדש"
        size="xl"
      >
        <ProjectTaskForm
          defaultQuadrant={1}
          onClose={handleCloseForm}
        />
      </Modal>
    </div>
  );
}

export default Dashboard;
