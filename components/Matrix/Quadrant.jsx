import { useTasks } from '../../hooks/useTasks';
import QuadrantHeader from './QuadrantHeader';
import TaskCard from '../Tasks/TaskCard';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * רבע במטריצה
 */
function Quadrant({
  id,
  title,
  subtitle,
  icon,
  colorClass,
  borderColor,
  isDropTarget = false,
  isDragging = false,
  isMobile = false,
  onAddTask,
  onEditTask,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}) {
  const { getTasksByQuadrant } = useTasks();
  const tasks = getTasksByQuadrant(id);

  return (
    <div
      className={`
        ${colorClass} border-2 ${borderColor}
        rounded-xl overflow-hidden
        transition-all duration-200
        ${isDropTarget ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900 scale-[1.02]' : ''}
        ${isDragging ? 'bg-opacity-50' : ''}
        ${isMobile ? 'min-h-[60vh]' : 'min-h-[300px]'}
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* כותרת הרבע */}
      <QuadrantHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        count={tasks.length}
        onAddTask={onAddTask}
      />

      {/* רשימת משימות */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">אין משימות</p>
            <button
              onClick={onAddTask}
              className="mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              + הוסף משימה ראשונה
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <TaskCard
                  task={task}
                  quadrantId={id}
                  onEdit={() => onEditTask(task)}
                  onDragStart={() => onDragStart(task)}
                  onDragEnd={onDragEnd}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default Quadrant;

