import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../hooks/useTasks';
import Matrix from '../components/Matrix/Matrix';
import TaskForm from '../components/Tasks/TaskForm';
import ProjectTaskForm from '../components/Tasks/ProjectTaskForm';
import TaskFilters from '../components/Tasks/TaskFilters';
import ExportButtons from '../components/Export/ExportButtons';
import MobileNav from '../components/Layout/MobileNav';
import Modal from '../components/UI/Modal';
import Button from '../components/UI/Button';
import Tabs from '../components/UI/Tabs';
import TimeAnalytics from '../components/Analytics/TimeAnalytics';
import PlanningVsExecution from '../components/Planning/PlanningVsExecution';
import ManualTimeUpdate from '../components/Tasks/ManualTimeUpdate';

/**
 * דף לוח המחוונים הראשי
 */
function Dashboard() {
  const { loading, error, getStats, tasks, loadTasks } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeQuadrant, setActiveQuadrant] = useState(null); // לנייד
  const stats = getStats();

  // פתיחת טופס הוספת משימה
  // חשוב: ניתן להוסיף משימות חדשות תמיד, ללא הגבלה על משימות פעילות או לא הושלמו
  const handleAddTask = (quadrant = 1) => {
    setEditingTask(null);
    setActiveQuadrant(quadrant);
    setShowTaskForm(true);
    setShowProjectForm(false);
  };

  // פתיחת טופס יצירת פרויקט
  const handleAddProject = (quadrant = 1) => {
    setEditingTask(null);
    setActiveQuadrant(quadrant);
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
            label: 'ניתוח זמן',
            icon: '⏱️',
            content: <TimeAnalytics />
          },
          {
            label: 'משימות',
            icon: '📋',
            content: (
              <div>
                <Matrix 
                  onAddTask={handleAddTask}
                  onEditTask={handleEditTask}
                />
                <MobileNav onAddTask={handleAddTask} />
              </div>
            )
          }
        ]}
      />

      {/* מודל טופס משימה */}
      <Modal
                      {tasks
                        .filter(t => !t.is_project && !t.parent_task_id && (t.time_spent || 0) > 0)
                        .sort((a, b) => (b.time_spent || 0) - (a.time_spent || 0))
                        .map(task => {
                          const timeSpent = task.time_spent || 0;
                          const estimated = task.estimated_duration || 0;
                          const formatTime = (minutes) => {
                            if (minutes < 60) return `${minutes} דקות`;
                            const hours = Math.floor(minutes / 60);
                            const mins = minutes % 60;
                            return mins > 0 ? `${hours} שעות ${mins} דקות` : `${hours} שעות`;
                          };
                          
                          return (
                            <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                  {task.title}
                                </h3>
                                {task.is_completed && (
                                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                    ✓ הושלמה
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">זמן שבוצע:</span>
                                  <span className="font-bold text-blue-600 dark:text-blue-400">
                                    {formatTime(timeSpent)}
                                  </span>
                                </div>
                                {estimated > 0 && (
                                  <>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-gray-600 dark:text-gray-400">זמן משוער:</span>
                                      <span className="text-gray-700 dark:text-gray-300">
                                        {formatTime(estimated)}
                                      </span>
                                    </div>
                                    {(() => {
                                      const progress = Math.min(100, Math.round((timeSpent / estimated) * 100));
                                      return (
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-500 dark:text-gray-400">התקדמות</span>
                                            <span className={progress > 100 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'}>
                                              {progress}%
                                            </span>
                                          </div>
                                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full transition-all duration-300 ${
                                                progress >= 100 
                                                  ? 'bg-red-500' 
                                                  : progress >= 75 
                                                  ? 'bg-green-500' 
                                                  : progress >= 50 
                                                  ? 'bg-blue-500' 
                                                  : 'bg-yellow-500'
                                              }`}
                                              style={{ width: `${Math.min(100, progress)}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </>
                                )}
                                {task.estimated_duration && (
                                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <TaskTimer
                                      task={task}
                                      onUpdate={loadTasks}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
                
                {/* משימות רגילות עם טיימר (רק אם יש זמן משוער אבל עדיין לא זמן שבוצע) */}
                {tasks && tasks.filter(t => !t.is_project && !t.parent_task_id && t.estimated_duration && !(t.time_spent || 0)).length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      משימות עם טיימר (עדיין לא התחלת)
                    </h2>
                    <div className="space-y-4">
                      {tasks
                        .filter(t => !t.is_project && !t.parent_task_id && t.estimated_duration && !(t.time_spent || 0))
                        .map(task => (
                          <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                              {task.title}
                            </h3>
                            <TaskTimer
                              task={task}
                              onUpdate={loadTasks}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                {/* פרויקטים עם שלבים */}
                {tasks && tasks.filter(t => t.is_project && t.subtasks && t.subtasks.length > 0).length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      מעקב התקדמות בשלבים
                    </h2>
                    {tasks
                      .filter(t => t.is_project && t.subtasks && t.subtasks.length > 0)
                      .map(project => (
                        <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {project.title}
                          </h3>
                          <div className="space-y-3">
                            {project.subtasks.map(subtask => (
                              <ProgressTracker
                                key={subtask.id}
                                subtask={subtask}
                                onUpdate={loadTasks}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                
                {/* אין משימות */}
                {(!tasks || 
                  (tasks.filter(t => !t.is_project && !t.parent_task_id && ((t.time_spent || 0) > 0 || t.estimated_duration)).length === 0 &&
                   tasks.filter(t => t.is_project && t.subtasks && t.subtasks.length > 0).length === 0)) && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <span className="text-4xl mb-4 block">📋</span>
                    <p className="text-lg font-medium mb-2">אין משימות עם מעקב זמן</p>
                    <p className="text-sm mb-4">הוסיפי זמן משוער למשימות או השתמשי בטיימר כדי להתחיל לעקוב אחר הזמן</p>
                    <div className="flex gap-2 justify-center mt-4">
                      <Button
                        onClick={() => handleAddTask(1)}
                        className="mt-4"
                      >
                        צור משימה חדשה
                      </Button>
                      <Button
                        onClick={() => handleAddProject(1)}
                        className="mt-4"
                      >
                        צור פרויקט חדש
                      </Button>
                    </div>
                  </div>
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <TaskForm
          task={editingTask}
          defaultQuadrant={activeQuadrant}
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
          defaultQuadrant={activeQuadrant || 1}
          onClose={handleCloseForm}
        />
      </Modal>
    </div>
  );
}

export default Dashboard;

