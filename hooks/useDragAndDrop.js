import { useState, useCallback } from 'react';
import { useTasks } from './useTasks';
import toast from 'react-hot-toast';

/**
 * Hook לטיפול בגרירה ושחרור של משימות
 */
export function useDragAndDrop() {
  const { changeQuadrant } = useTasks();
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState(null);

  // התחלת גרירה
  const handleDragStart = useCallback((task) => {
    setDraggedTask(task);
  }, []);

  // סיום גרירה
  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverQuadrant(null);
  }, []);

  // גרירה מעל רבע
  const handleDragOver = useCallback((e, quadrant) => {
    e.preventDefault();
    setDragOverQuadrant(quadrant);
  }, []);

  // עזיבת רבע
  const handleDragLeave = useCallback(() => {
    setDragOverQuadrant(null);
  }, []);

  // שחרור ברבע
  const handleDrop = useCallback(async (e, targetQuadrant) => {
    e.preventDefault();
    
    if (!draggedTask) return;
    
    // אם אותו רבע - לא לעשות כלום
    if (draggedTask.quadrant === targetQuadrant) {
      handleDragEnd();
      return;
    }

    try {
      await changeQuadrant(draggedTask.id, targetQuadrant);
      
      const quadrantNames = {
        1: 'דחוף וחשוב',
        2: 'חשוב',
        3: 'דחוף',
        4: 'לא דחוף'
      };
      
      toast.success(`המשימה הועברה ל"${quadrantNames[targetQuadrant]}"`);
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    }
    
    handleDragEnd();
  }, [draggedTask, changeQuadrant, handleDragEnd]);

  return {
    draggedTask,
    dragOverQuadrant,
    isDragging: !!draggedTask,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
}

export default useDragAndDrop;

