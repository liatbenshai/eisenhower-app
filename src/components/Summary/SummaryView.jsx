import { useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * תצוגת סיכום כללי
 */
function SummaryView() {
  const { tasks, getStats } = useTasks();
  const stats = getStats();
  
  // חישוב סטטיסטיקות מפורטות
  const detailedStats = useMemo(() => {
    const projects = tasks.filter(t => t.is_project);
    const regularTasks = tasks.filter(t => !t.is_project && !t.parent_task_id);
    const subtasks = tasks.filter(t => t.parent_task_id);
    
    // חישוב התקדמות פרויקטים
    const projectsWithProgress = projects.map(project => {
      const projectSubtasks = subtasks.filter(st => st.parent_task_id === project.id);
      const completedSubtasks = projectSubtasks.filter(st => st.is_completed).length;
      const totalSubtasks = projectSubtasks.length;
      
      // התקדמות לפי שלבים שהושלמו
      const progressByCompletion = totalSubtasks > 0 
        ? Math.round((completedSubtasks / totalSubtasks) * 100)
        : 0;
      
      // חישוב זמן כולל
      const totalEstimated = projectSubtasks.reduce((sum, st) => 
        sum + (st.estimated_duration || 0), 0
      );
      const totalSpent = projectSubtasks.reduce((sum, st) => 
        sum + (st.time_spent || 0), 0
      );
      
      // התקדמות לפי זמן
      const progressByTime = totalEstimated > 0
        ? Math.min(100, Math.round((totalSpent / totalEstimated) * 100))
        : 0;
      
      // התקדמות משולבת (ממוצע)
      const progress = Math.round((progressByCompletion + progressByTime) / 2);
      
      return {
        ...project,
        progress,
        progressByCompletion,
        progressByTime,
        totalSubtasks,
        completedSubtasks,
        totalEstimated,
        totalSpent
      };
    });
    
    // משימות לפי רבע
    const byQuadrant = {
      1: tasks.filter(t => t.quadrant === 1).length,
      2: tasks.filter(t => t.quadrant === 2).length,
      3: tasks.filter(t => t.quadrant === 3).length,
      4: tasks.filter(t => t.quadrant === 4).length
    };
    
    // משימות קרובות (היום או מחר)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const upcomingTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return (dueDate.getTime() === today.getTime() || dueDate.getTime() === tomorrow.getTime()) && !task.is_completed;
    });
    
    // משימות באיחור
    const overdueTasks = tasks.filter(task => {
      if (!task.due_date || task.is_completed) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
    
    return {
      projects: projectsWithProgress,
      regularTasks: regularTasks.length,
      subtasks: subtasks.length,
      byQuadrant,
      upcomingTasks,
      overdueTasks
    };
  }, [tasks]);
  
  return (
    <div className="space-y-6">
      {/* כותרת */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          סיכום כללי
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {format(new Date(), 'dd MMMM yyyy', { locale: he })}
        </p>
      </div>
      
      {/* סטטיסטיקות כלליות */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">סה"כ משימות</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">הושלמו</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <span className="text-2xl">⏰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">קרובות</p>
              <p className="text-2xl font-bold text-orange-600">{detailedStats.upcomingTasks.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">באיחור</p>
              <p className="text-2xl font-bold text-red-600">{detailedStats.overdueTasks.length}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* פרויקטים */}
      {detailedStats.projects.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            פרויקטים ({detailedStats.projects.length})
          </h3>
          <div className="space-y-4">
            {detailedStats.projects.map(project => (
              <div key={project.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">{project.title}</h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {project.completedSubtasks} / {project.totalSubtasks} שלבים
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">התקדמות כללית</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          project.progress >= 100 
                            ? 'bg-green-500' 
                            : project.progress >= 75 
                            ? 'bg-blue-500' 
                            : project.progress >= 50 
                            ? 'bg-yellow-500' 
                            : 'bg-orange-500'
                        }`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">זמן: </span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {project.progressByTime}%
                      </span>
                      {project.totalEstimated > 0 && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {' '}({project.totalSpent}/{project.totalEstimated}ד')
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">שלבים: </span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {project.progressByCompletion}%
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        {' '}({project.completedSubtasks}/{project.totalSubtasks})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* חלוקה לפי רבעים */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          חלוקה לפי רבעים
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 1, name: 'דחוף וחשוב', color: 'red', icon: '🔴' },
            { id: 2, name: 'חשוב אך לא דחוף', color: 'blue', icon: '🔵' },
            { id: 3, name: 'דחוף אך לא חשוב', color: 'orange', icon: '🟠' },
            { id: 4, name: 'לא דחוף ולא חשוב', color: 'gray', icon: '⚫' }
          ].map(quadrant => (
            <div key={quadrant.id} className="text-center">
              <div className="text-3xl mb-2">{quadrant.icon}</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{quadrant.name}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {detailedStats.byQuadrant[quadrant.id]}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      {/* משימות עם זמן שבוצע */}
      {(() => {
        const tasksWithTime = tasks
          .filter(t => !t.is_project && !t.parent_task_id && (t.time_spent || 0) > 0)
          .sort((a, b) => (b.time_spent || 0) - (a.time_spent || 0))
          .slice(0, 10); // 10 המשימות עם הכי הרבה זמן
        
        if (tasksWithTime.length === 0) return null;
        
        const formatTime = (minutes) => {
          if (minutes < 60) return `${minutes} דקות`;
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return mins > 0 ? `${hours} שעות ${mins} דקות` : `${hours} שעות`;
        };
        
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              משימות עם זמן שבוצע
            </h3>
            <div className="space-y-3">
              {tasksWithTime.map(task => {
                const timeSpent = task.time_spent || 0;
                const estimated = task.estimated_duration || 0;
                const progress = estimated > 0 ? Math.min(100, Math.round((timeSpent / estimated) * 100)) : 0;
                
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {task.title}
                        </span>
                        {task.is_completed && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            הושלמה
                          </span>
                        )}
                        {!task.is_completed && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            פעילה
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatTime(timeSpent)}
                        </span>
                        {estimated > 0 && (
                          <>
                            <span>/ {formatTime(estimated)} משוער</span>
                            <span className={progress > 100 ? 'text-red-600 dark:text-red-400' : ''}>
                              ({progress}%)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default SummaryView;

