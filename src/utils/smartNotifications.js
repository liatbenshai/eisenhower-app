/**
 * תזכורות חכמות - התראות מותאמות לפי דפוסי עבודה והתקדמות
 */

/**
 * חישוב זמן אופטימלי להתראה
 */
export function calculateOptimalReminderTime(task, workPatterns = null) {
  if (!task.due_date) return null;

  const dueDate = new Date(task.due_date);
  const now = new Date();
  
  // אם המשימה כבר עברה, לא נשלח התראה
  if (dueDate < now) return null;

  // זמן ברירת מחדל - 15 דקות לפני
  let reminderMinutes = 15;

  // אם יש דפוסי עבודה, נשתמש בהם
  if (workPatterns && workPatterns.bestTimeForQuadrant) {
    const bestHour = workPatterns.bestTimeForQuadrant[task.quadrant];
    if (bestHour !== null) {
      // נשלח התראה בשעה הפרודוקטיבית, או שעה לפני אם זה קרוב מדי
      const bestTime = new Date(dueDate);
      bestTime.setHours(bestHour, 0, 0, 0);
      
      const hoursUntilBest = (bestTime - now) / (1000 * 60 * 60);
      
      if (hoursUntilBest > 0 && hoursUntilBest < 24) {
        // אם השעה הפרודוקטיבית היא לפני תאריך היעד, נשלח התראה בשעה הזו
        if (bestTime < dueDate) {
          return bestTime;
        }
      }
    }
  }

  // חישוב זמן התראה לפי דחיפות
  const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
  
  if (daysUntilDue <= 1) {
    // משימה דחופה - התראה 30 דקות לפני
    reminderMinutes = 30;
  } else if (daysUntilDue <= 3) {
    // משימה קרובה - התראה שעה לפני
    reminderMinutes = 60;
  } else if (daysUntilDue <= 7) {
    // משימה בשבוע הקרוב - התראה יום לפני
    reminderMinutes = 24 * 60;
  } else {
    // משימה רחוקה - התראה 3 ימים לפני
    reminderMinutes = 3 * 24 * 60;
  }

  // התאמה לפי רבע
  if (task.quadrant === 1) {
    // דחוף וחשוב - התראה מוקדמת יותר
    reminderMinutes = Math.max(reminderMinutes, 60);
  } else if (task.quadrant === 2) {
    // חשוב אך לא דחוף - התראה יום לפני
    reminderMinutes = Math.max(reminderMinutes, 24 * 60);
  }

  const reminderTime = new Date(dueDate.getTime() - reminderMinutes * 60 * 1000);
  
  // אם הזמן כבר עבר, נשלח התראה עכשיו
  if (reminderTime < now) {
    return now;
  }

  return reminderTime;
}

/**
 * בדיקה אם צריך התראה על משימה
 */
export function shouldNotifyTask(task, lastNotification = null) {
  if (!task.due_date || task.is_completed) return false;

  const dueDate = new Date(task.due_date);
  const now = new Date();
  
  // אם המשימה כבר עברה, נשלח התראה
  if (dueDate < now && !task.is_completed) {
    return {
      shouldNotify: true,
      priority: 'high',
      message: `⚠️ משימה באיחור: ${task.title}`,
      reason: 'overdue'
    };
  }

  // אם המשימה היום, נשלח התראה
  const isToday = dueDate.toDateString() === now.toDateString();
  if (isToday && (!lastNotification || new Date(lastNotification) < now)) {
    return {
      shouldNotify: true,
      priority: 'high',
      message: `📅 משימה היום: ${task.title}`,
      reason: 'due_today'
    };
  }

  // אם המשימה מחר, נשלח התראה
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = dueDate.toDateString() === tomorrow.toDateString();
  if (isTomorrow && (!lastNotification || new Date(lastNotification) < now)) {
    return {
      shouldNotify: true,
      priority: 'medium',
      message: `⏰ משימה מחר: ${task.title}`,
      reason: 'due_tomorrow'
    };
  }

  return { shouldNotify: false };
}

/**
 * בדיקה אם צריך התראה על התקדמות
 */
export function shouldNotifyProgress(task) {
  if (!task.estimated_duration || !task.time_spent) return null;

  const progress = (task.time_spent / task.estimated_duration) * 100;
  
  // אם עבר 50% מהזמן המשוער
  if (progress >= 50 && progress < 75) {
    return {
      shouldNotify: true,
      priority: 'medium',
      message: `📊 התקדמות: ${task.title} - ${Math.round(progress)}% הושלם`,
      reason: 'halfway'
    };
  }

  // אם עבר 75% מהזמן המשוער
  if (progress >= 75 && progress < 100) {
    return {
      shouldNotify: true,
      priority: 'high',
      message: `⚡ כמעט סיימת: ${task.title} - ${Math.round(progress)}% הושלם`,
      reason: 'almost_done'
    };
  }

  // אם עבר 100% מהזמן המשוער ועדיין לא הושלם
  if (progress >= 100 && !task.is_completed) {
    return {
      shouldNotify: true,
      priority: 'high',
      message: `⏰ עברת את הזמן המשוער: ${task.title}`,
      reason: 'over_estimated'
    };
  }

  return null;
}

/**
 * בדיקה אם צריך התראה על פרויקט
 */
export function shouldNotifyProject(project, subtasks = []) {
  if (!project.is_project || subtasks.length === 0) return null;

  const completedSubtasks = subtasks.filter(st => st.is_completed).length;
  const progress = (completedSubtasks / subtasks.length) * 100;

  // אם 50% מהשלבים הושלמו
  if (progress >= 50 && progress < 75) {
    return {
      shouldNotify: true,
      priority: 'medium',
      message: `📈 התקדמות פרויקט: ${project.title} - ${Math.round(progress)}% הושלם`,
      reason: 'project_halfway'
    };
  }

  // אם 75% מהשלבים הושלמו
  if (progress >= 75 && progress < 100) {
    return {
      shouldNotify: true,
      priority: 'high',
      message: `🎯 כמעט סיימת פרויקט: ${project.title} - ${Math.round(progress)}% הושלם`,
      reason: 'project_almost_done'
    };
  }

  // בדיקת שלבים באיחור
  const overdueSubtasks = subtasks.filter(st => {
    if (st.is_completed || !st.due_date) return false;
    const dueDate = new Date(st.due_date);
    return dueDate < new Date();
  });

  if (overdueSubtasks.length > 0) {
    return {
      shouldNotify: true,
      priority: 'high',
      message: `⚠️ יש ${overdueSubtasks.length} שלבים באיחור בפרויקט: ${project.title}`,
      reason: 'project_overdue'
    };
  }

  return null;
}

/**
 * יצירת הודעת התראה מותאמת
 */
export function createSmartNotification(task, notificationType, workPatterns = null) {
  const baseNotification = {
    title: task.title,
    body: task.description || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `task-${task.id}-${notificationType}`,
    data: { taskId: task.id, type: notificationType },
    dir: 'rtl',
    lang: 'he'
  };

  // התאמה לפי סוג התראה
  switch (notificationType) {
    case 'overdue':
      return {
        ...baseNotification,
        title: `⚠️ משימה באיחור: ${task.title}`,
        body: 'הגיע הזמן לטפל במשימה זו',
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
      };

    case 'due_today':
      return {
        ...baseNotification,
        title: `📅 משימה היום: ${task.title}`,
        body: task.description || 'זו המשימה שלך להיום',
        requireInteraction: false,
        vibrate: [200, 100, 200]
      };

    case 'due_tomorrow':
      return {
        ...baseNotification,
        title: `⏰ משימה מחר: ${task.title}`,
        body: 'תזכורת: המשימה שלך מחר',
        requireInteraction: false
      };

    case 'optimal_time':
      const bestHour = workPatterns?.bestTimeForQuadrant?.[task.quadrant];
      return {
        ...baseNotification,
        title: `💡 זמן אופטימלי: ${task.title}`,
        body: bestHour ? `השעה ${bestHour}:00 היא הזמן הכי פרודוקטיבי שלך למשימות מהסוג הזה` : 'זה זמן טוב לעבוד על המשימה',
        requireInteraction: false
      };

    case 'progress':
      return {
        ...baseNotification,
        title: `📊 התקדמות: ${task.title}`,
        body: `עברת ${Math.round((task.time_spent / task.estimated_duration) * 100)}% מהזמן המשוער`,
        requireInteraction: false
      };

    default:
      return baseNotification;
  }
}

/**
 * קבלת כל ההתראות הנדרשות
 */
export function getAllNotifications(tasks, workPatterns = null) {
  const notifications = [];

  tasks.forEach(task => {
    // בדיקת התראות על תאריך יעד
    const dueNotification = shouldNotifyTask(task);
    if (dueNotification?.shouldNotify) {
      notifications.push({
        task,
        type: dueNotification.reason,
        priority: dueNotification.priority,
        message: dueNotification.message,
        notification: createSmartNotification(task, dueNotification.reason, workPatterns)
      });
    }

    // בדיקת התראות על התקדמות
    if (!task.is_project) {
      const progressNotification = shouldNotifyProgress(task);
      if (progressNotification?.shouldNotify) {
        notifications.push({
          task,
          type: progressNotification.reason,
          priority: progressNotification.priority,
          message: progressNotification.message,
          notification: createSmartNotification(task, 'progress', workPatterns)
        });
      }
    }

    // בדיקת התראות על פרויקטים
    if (task.is_project && task.subtasks) {
      const projectNotification = shouldNotifyProject(task, task.subtasks);
      if (projectNotification?.shouldNotify) {
        notifications.push({
          task,
          type: projectNotification.reason,
          priority: projectNotification.priority,
          message: projectNotification.message,
          notification: createSmartNotification(task, 'project', workPatterns)
        });
      }
    }
  });

  // מיון לפי עדיפות
  notifications.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return notifications;
}

