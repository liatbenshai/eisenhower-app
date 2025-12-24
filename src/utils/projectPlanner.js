/**
 * כלי תכנון אוטומטי לפרויקטים
 * מחלק פרויקטים לשלבים לפי תאריך יעד, כמות משימות וזמן משוער
 */

/**
 * חישוב תאריכים לשלבים
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך יעד
 * @param {number} numSubtasks - מספר שלבים
 * @returns {Date[]} - מערך תאריכים
 */
export function calculateSubtaskDates(startDate, endDate, numSubtasks) {
  if (numSubtasks <= 1) {
    return [endDate];
  }

  const dates = [];
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const daysPerSubtask = Math.max(1, Math.floor(totalDays / numSubtasks));

  for (let i = 0; i < numSubtasks; i++) {
    const daysToAdd = i * daysPerSubtask;
    const date = new Date(startDate);
    date.setDate(date.getDate() + daysToAdd);
    
    // השלב האחרון תמיד יהיה תאריך היעד
    if (i === numSubtasks - 1) {
      dates.push(endDate);
    } else {
      dates.push(date);
    }
  }

  return dates;
}

/**
 * חישוב זמן משוער לכל שלב
 * @param {number} totalDuration - זמן כולל בדקות
 * @param {number} numSubtasks - מספר שלבים
 * @param {number[]} weights - משקלים יחסיים לכל שלב (אופציונלי)
 * @returns {number[]} - מערך זמנים בדקות
 */
export function calculateSubtaskDurations(totalDuration, numSubtasks, weights = null) {
  if (numSubtasks <= 1) {
    return [totalDuration];
  }

  if (weights && weights.length === numSubtasks) {
    // חלוקה לפי משקלים
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    return weights.map(w => Math.round((w / totalWeight) * totalDuration));
  }

  // חלוקה שווה
  const durationPerSubtask = Math.round(totalDuration / numSubtasks);
  const durations = new Array(numSubtasks).fill(durationPerSubtask);
  
  // תיקון עיגול - הוספת השארית לשלב האחרון
  const remainder = totalDuration - (durationPerSubtask * numSubtasks);
  if (remainder > 0) {
    durations[durations.length - 1] += remainder;
  }

  return durations;
}

/**
 * יצירת הצעה אוטומטית לחלוקת פרויקט
 * @param {Object} projectData - נתוני הפרויקט
 * @param {Date} projectData.startDate - תאריך התחלה
 * @param {Date} projectData.endDate - תאריך יעד
 * @param {number} projectData.totalDuration - זמן כולל בדקות
 * @param {number} projectData.numSubtasks - מספר שלבים רצוי
 * @param {string[]} projectData.subtaskTitles - כותרות שלבים (אופציונלי)
 * @returns {Object[]} - מערך שלבים מוצעים
 */
export function generateSubtaskPlan(projectData) {
  const {
    startDate,
    endDate,
    totalDuration,
    numSubtasks,
    subtaskTitles = []
  } = projectData;

  // חישוב תאריכים
  const dates = calculateSubtaskDates(
    new Date(startDate),
    new Date(endDate),
    numSubtasks
  );

  // חישוב זמנים
  const durations = calculateSubtaskDurations(totalDuration, numSubtasks);

  // יצירת שלבים
  const subtasks = [];
  for (let i = 0; i < numSubtasks; i++) {
    const date = dates[i];
    const duration = durations[i];
    
    subtasks.push({
      title: subtaskTitles[i] || `שלב ${i + 1}`,
      description: '',
      dueDate: date.toISOString().split('T')[0],
      dueTime: i === numSubtasks - 1 ? '23:59' : null, // שלב אחרון - סוף היום
      estimatedDuration: duration,
      orderIndex: i
    });
  }

  return subtasks;
}

/**
 * הצעה חכמה למספר שלבים
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך יעד
 * @param {number} totalDuration - זמן כולל בשעות
 * @returns {number} - מספר שלבים מוצע
 */
export function suggestNumSubtasks(startDate, endDate, totalDuration) {
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const hours = totalDuration / 60; // המרה מדקות לשעות
  
  // חישוב בסיסי: שלב לכל 2-3 ימים או לכל 4-8 שעות עבודה
  const byDays = Math.max(1, Math.ceil(days / 2.5));
  const byHours = Math.max(1, Math.ceil(hours / 6));
  
  // ממוצע משוקלל
  const suggested = Math.round((byDays + byHours) / 2);
  
  // הגבלות: מינימום 1, מקסימום 10
  return Math.min(10, Math.max(1, suggested));
}

/**
 * הצעה חכמה לזמן כולל
 * @param {number} numSubtasks - מספר שלבים
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך יעד
 * @returns {number} - זמן מוצע בדקות
 */
export function suggestTotalDuration(numSubtasks, startDate, endDate) {
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const hoursPerDay = 4; // הנחה: 4 שעות עבודה ביום
  const totalHours = days * hoursPerDay;
  
  // חלוקה לשלבים
  const hoursPerSubtask = totalHours / numSubtasks;
  
  // המרה לדקות
  return Math.round(hoursPerSubtask * 60 * numSubtasks);
}

