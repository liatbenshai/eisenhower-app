import { useTasks } from '../../hooks/useTasks';
import TaskCard from './TaskCard';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * רשימת משימות - תצוגה רשימתית
 */
function TaskList({ 
  onEditTask,
  emptyMessage = 'אין משימות' 
}) {
  const { getFilteredTasks } = useTasks();
  
  // קבלת כל המשימות (לא לפי מטריצה)
  const tasks = getFilteredTasks().filter(t => !t.is_completed && !t.is_project);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <span className="text-4xl mb-4 block">📋</span>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ delay: index * 0.03 }}
          >
            <TaskCard
              task={task}
              onEdit={() => onEditTask(task)}
              onDragStart={() => {}}
              onDragEnd={() => {}}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default TaskList;

