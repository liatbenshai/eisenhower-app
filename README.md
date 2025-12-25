# עדכון מערכת אייזנהאואר
## תאריך: December 2025

---

## סיכום תיקונים

### 1. תצוגה שבועית ✅
- תוקן: משימות שנמחקו או הושלמו לא מופיעות יותר

### 2. טיימר ביומן שעות ✅
- תוקן: כפתור "התחל עבודה" עובד כמו שצריך
- לחיצה על הטיימר לא סוגרת את הכרטיס

### 3. משימות דחופות ✅
- חדש: כשמוסיפים משימה דחופה, המערכת מציעה לדחות משימות **פחות דחופות מאותו יום** (לא רק חופפות בשעה)
- הכפתור הראשון: "🚀 דחה X משימות פחות דחופות ושבץ אותי"

### 4. הצעות שיבוץ חכמות ✅
- כשמזינים זמן משוער, מוצגות הצעות לשעות פנויות
- לחיצה על הצעה ממלאת תאריך ושעה אוטומטית
- עובד לפי: 7 שעות עבודה, מ-08:00

---

## קבצים לעדכון

```
src/components/DailyView/WeeklyCalendarView.jsx  ← תיקון משימות מחוקות
src/components/DailyView/DiaryView.jsx           ← לוגים לדיבאג
src/components/DailyView/SimpleTaskForm.jsx      ← הצעות שיבוץ
src/components/Tasks/ScheduleConflictAlert.jsx   ← משימות דחופות
src/components/Tasks/TaskTimerWithInterruptions.jsx ← תיקון טיימר
src/components/Tasks/TaskForm.jsx
src/utils/slotSuggester.js                       ← הגדרות: 7 שעות, 08:00
src/utils/smartScheduler.js                      ← מעודכן
src/utils/timeOverlap.js
src/utils/urgentRescheduler.js
src/utils/smartTaskSplitter.js
```

---

## הגדרות (slotSuggester.js)

```javascript
WORK_START_HOUR: 8,           // 08:00
DAILY_CAPACITY_MINUTES: 420,  // 7 שעות
BREAK_AFTER_MINUTES: 90,      // הפסקה כל 90 דק'
BREAK_DURATION: 10,           // 10 דק' הפסקה
LUNCH_HOUR: 12,               // צהריים
LUNCH_DURATION: 30            // 30 דק' צהריים
```

---

## בדיקות

1. **תצוגה שבועית:** וודאי שמשימות שמחקת לא מופיעות
2. **טיימר:** יומן שעות → לחצי על משימה → "התחל עבודה"
3. **משימה דחופה:** הוסיפי משימה דחופה ביום עמוס → תראי הצעה לדחות משימות פחות דחופות
4. **הצעות:** הזיני זמן משוער בטופס → תראי כפתורים עם הצעות זמן
