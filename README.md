# עדכון מערכת פיצול משימות + התראות חפיפות
## תאריך: December 2025

---

## קבצים לעדכון

```
src/utils/smartTaskSplitter.js               ← החלף
src/utils/urgentRescheduler.js               ← החלף
src/utils/timeOverlap.js                     ← החלף
src/components/Tasks/TaskForm.jsx            ← החלף
src/components/Tasks/ScheduleConflictAlert.jsx ← החלף (תיקון למשימות דחופות!)
src/components/Tasks/TaskTimerWithInterruptions.jsx ← החלף (עם לוגים לדיבאג)
src/components/DailyView/SimpleTaskForm.jsx  ← החלף (עם דחיפות בהתראות)
src/components/DailyView/DiaryView.jsx       ← החלף (עם לוגים לדיבאג טיימר)
utils/smartTaskSplitter.js                   ← החלף
```

---

## מה חדש

### התראות למשימות דחופות
- כשמוסיפים משימה דחופה שחופפת למשימות פחות דחופות
- מציג רקע אדום עם 🚨
- כפתור "דחה את הפחות דחופות ושבץ אותי"
- מזהה אוטומטית משימות שאפשר לדחות

---

## Debug Mode

הגרסה כוללת לוגים ב-Console (F12):

**להתראות חפיפות:**
- `🔍 SimpleTaskForm - בדיקת חפיפות:`

**לטיימר:**
- `🎬 מציג טיימר למשימה:`
- `⏱️ TaskTimerWithInterruptions - קיבלתי:`
- `⏱️ מציג טיימר למשימה:`

---

## בדיקות

1. **משימה דחופה:** הוסיפי משימה דחופה (אדום) בשעה שיש כבר משימה רגילה
2. **טיימר:** ביומן שעות, לחצי על משימה ובדקי Console
