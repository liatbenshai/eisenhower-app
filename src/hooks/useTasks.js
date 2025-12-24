import { useContext } from 'react';
import { TaskContext } from '../context/TaskContext';

/**
 * Hook לשימוש בקונטקסט המשימות
 */
export function useTasks() {
  const context = useContext(TaskContext);
  
  if (!context) {
    throw new Error('useTasks חייב להיות בתוך TaskProvider');
  }
  
  return context;
}

export default useTasks;

