/**
 * עזרים לייצוא נתונים
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { QUADRANT_NAMES } from './taskHelpers';
import { formatDateHe } from './dateHelpers';

/**
 * ייצוא ל-PDF
 */
export async function exportToPDF(tasks, options = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // הגדרת כיוון RTL
  doc.setR2L(true);
  
  // כותרת
  doc.setFontSize(20);
  doc.text('מטריצת אייזנהאואר - משימות', 190, 20, { align: 'right' });
  
  // תאריך הפקה
  doc.setFontSize(10);
  doc.text(`הופק בתאריך: ${formatDateHe(new Date().toISOString())}`, 190, 28, { align: 'right' });

  // מעבר על כל רבע
  let yPosition = 40;
  
  for (let quadrant = 1; quadrant <= 4; quadrant++) {
    const quadrantTasks = tasks.filter(t => t.quadrant === quadrant);
    
    if (quadrantTasks.length === 0 && !options.includeEmpty) continue;

    // כותרת הרבע
    doc.setFontSize(14);
    doc.setTextColor(...getQuadrantPDFColor(quadrant));
    doc.text(QUADRANT_NAMES[quadrant], 190, yPosition, { align: 'right' });
    yPosition += 5;
    
    doc.setTextColor(0, 0, 0);

    if (quadrantTasks.length === 0) {
      doc.setFontSize(10);
      doc.text('אין משימות', 190, yPosition + 5, { align: 'right' });
      yPosition += 15;
      continue;
    }

    // טבלת משימות
    const tableData = quadrantTasks.map(task => [
      task.is_completed ? '✓' : '',
      task.due_date ? formatDateHe(task.due_date, { short: true }) : '-',
      task.title
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [['סטטוס', 'תאריך יעד', 'משימה']],
      body: tableData,
      theme: 'striped',
      styles: {
        font: 'helvetica',
        fontSize: 10,
        halign: 'right',
        direction: 'rtl'
      },
      headStyles: {
        fillColor: getQuadrantPDFColor(quadrant),
        textColor: 255,
        halign: 'right'
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 'auto' }
      },
      margin: { right: 15, left: 15 }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // בדיקה אם צריך עמוד חדש
    if (yPosition > 260) {
      doc.addPage();
      yPosition = 20;
    }
  }

  // שמירת הקובץ
  const fileName = options.fileName || `משימות_${getTodayFileName()}.pdf`;
  doc.save(fileName);
}

/**
 * ייצוא ל-Excel
 */
export async function exportToExcel(tasks, options = {}) {
  const workbook = XLSX.utils.book_new();

  if (options.separateSheets) {
    // גיליון נפרד לכל רבע
    for (let quadrant = 1; quadrant <= 4; quadrant++) {
      const quadrantTasks = tasks.filter(t => t.quadrant === quadrant);
      const sheetData = formatTasksForSheet(quadrantTasks);
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      
      // הגדרת רוחב עמודות
      worksheet['!cols'] = [
        { wch: 40 }, // משימה
        { wch: 50 }, // תיאור
        { wch: 15 }, // תאריך יעד
        { wch: 10 }, // שעה
        { wch: 10 }, // סטטוס
        { wch: 15 }  // תאריך יצירה
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, QUADRANT_NAMES[quadrant]);
    }
  } else {
    // גיליון אחד מאוחד
    const sheetData = formatTasksForSheet(tasks, true);
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    worksheet['!cols'] = [
      { wch: 20 }, // רבע
      { wch: 40 }, // משימה
      { wch: 50 }, // תיאור
      { wch: 15 }, // תאריך יעד
      { wch: 10 }, // שעה
      { wch: 10 }, // סטטוס
      { wch: 15 }  // תאריך יצירה
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'משימות');
  }

  // שמירת הקובץ
  const fileName = options.fileName || `משימות_${getTodayFileName()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * ייצוא ל-CSV
 */
export async function exportToCSV(tasks, options = {}) {
  const headers = ['רבע', 'משימה', 'תיאור', 'תאריך יעד', 'שעה', 'סטטוס', 'תאריך יצירה'];
  
  const rows = tasks.map(task => [
    QUADRANT_NAMES[task.quadrant],
    task.title,
    task.description || '',
    task.due_date || '',
    task.due_time || '',
    task.is_completed ? 'הושלם' : 'פעיל',
    formatDateHe(task.created_at, { short: true })
  ]);

  // יצירת תוכן CSV עם BOM לתמיכה בעברית
  const BOM = '\uFEFF';
  const csvContent = BOM + [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // יצירת קובץ והורדה
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName || `משימות_${getTodayFileName()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * פורמט משימות לגיליון Excel
 */
function formatTasksForSheet(tasks, includeQuadrant = false) {
  const headers = includeQuadrant
    ? ['רבע', 'משימה', 'תיאור', 'תאריך יעד', 'שעה', 'סטטוס', 'תאריך יצירה']
    : ['משימה', 'תיאור', 'תאריך יעד', 'שעה', 'סטטוס', 'תאריך יצירה'];

  const rows = tasks.map(task => {
    const baseRow = [
      task.title,
      task.description || '',
      task.due_date || '',
      task.due_time || '',
      task.is_completed ? 'הושלם' : 'פעיל',
      formatDateHe(task.created_at, { short: true })
    ];

    return includeQuadrant
      ? [QUADRANT_NAMES[task.quadrant], ...baseRow]
      : baseRow;
  });

  return [headers, ...rows];
}

/**
 * קבלת צבע רבע ל-PDF
 */
function getQuadrantPDFColor(quadrant) {
  const colors = {
    1: [239, 68, 68],   // אדום
    2: [59, 130, 246],  // כחול
    3: [249, 115, 22],  // כתום
    4: [107, 114, 128]  // אפור
  };
  return colors[quadrant] || colors[4];
}

/**
 * שם קובץ עם תאריך
 */
function getTodayFileName() {
  const today = new Date();
  return `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
}

export default {
  exportToPDF,
  exportToExcel,
  exportToCSV
};

