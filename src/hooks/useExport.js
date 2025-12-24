import { useState, useCallback } from 'react';
import { useTasks } from './useTasks';
import { exportToPDF, exportToExcel, exportToCSV } from '../utils/exportHelpers';
import toast from 'react-hot-toast';

/**
 * Hook לייצוא נתונים
 */
export function useExport() {
  const { tasks } = useTasks();
  const [exporting, setExporting] = useState(false);

  // ייצוא ל-PDF
  const handleExportPDF = useCallback(async (options = {}) => {
    setExporting(true);
    try {
      const tasksToExport = filterTasks(tasks, options);
      await exportToPDF(tasksToExport, options);
      toast.success('הקובץ יוצא בהצלחה');
    } catch (err) {
      console.error('שגיאה בייצוא PDF:', err);
      toast.error('שגיאה בייצוא הקובץ');
    } finally {
      setExporting(false);
    }
  }, [tasks]);

  // ייצוא ל-Excel
  const handleExportExcel = useCallback(async (options = {}) => {
    setExporting(true);
    try {
      const tasksToExport = filterTasks(tasks, options);
      await exportToExcel(tasksToExport, options);
      toast.success('הקובץ יוצא בהצלחה');
    } catch (err) {
      console.error('שגיאה בייצוא Excel:', err);
      toast.error('שגיאה בייצוא הקובץ');
    } finally {
      setExporting(false);
    }
  }, [tasks]);

  // ייצוא ל-CSV
  const handleExportCSV = useCallback(async (options = {}) => {
    setExporting(true);
    try {
      const tasksToExport = filterTasks(tasks, options);
      await exportToCSV(tasksToExport, options);
      toast.success('הקובץ יוצא בהצלחה');
    } catch (err) {
      console.error('שגיאה בייצוא CSV:', err);
      toast.error('שגיאה בייצוא הקובץ');
    } finally {
      setExporting(false);
    }
  }, [tasks]);

  return {
    exporting,
    exportPDF: handleExportPDF,
    exportExcel: handleExportExcel,
    exportCSV: handleExportCSV
  };
}

/**
 * סינון משימות לייצוא
 */
function filterTasks(tasks, options) {
  let filtered = [...tasks];

  // סינון לפי רבע
  if (options.quadrant) {
    filtered = filtered.filter(t => t.quadrant === options.quadrant);
  }

  // סינון לפי סטטוס
  if (options.status === 'active') {
    filtered = filtered.filter(t => !t.is_completed);
  } else if (options.status === 'completed') {
    filtered = filtered.filter(t => t.is_completed);
  }

  // סינון לפי תאריכים
  if (options.fromDate) {
    filtered = filtered.filter(t => 
      t.due_date && new Date(t.due_date) >= new Date(options.fromDate)
    );
  }
  if (options.toDate) {
    filtered = filtered.filter(t => 
      t.due_date && new Date(t.due_date) <= new Date(options.toDate)
    );
  }

  return filtered;
}

export default useExport;

