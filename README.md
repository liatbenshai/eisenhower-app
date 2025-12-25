# עדכון מערכת פיצול משימות + התראות חפיפות
## תאריך: December 2025

---

## קבצים לעדכון

```
src/utils/smartTaskSplitter.js         ← החלף
src/utils/urgentRescheduler.js         ← החלף
src/utils/timeOverlap.js               ← החלף (חשוב!)
src/components/Tasks/TaskForm.jsx      ← החלף (לתצוגת רשימה)
src/components/Tasks/ScheduleConflictAlert.jsx ← הוסף (חדש!)
src/components/DailyView/SimpleTaskForm.jsx   ← החלף (ליומן שעות!)
utils/smartTaskSplitter.js             ← החלף
```

---

## Debug Mode

הגרסה כוללת לוגים ב-Console (F12):
- `🔍 SimpleTaskForm - בדיקת חפיפות:` - מראה את הבדיקה
- `🔄 תוצאת חפיפות:` - מה נמצא
- `⚠️ נמצאה חפיפה!` - כשיש התנגשות

---

## בדיקה ביומן השעות

1. פתחי F12 > Console
2. לחצי "+ משימה" ביומן השעות
3. הזיני שם, זמן, ובחרי **שעה** שכבר קיימת משימה בה
4. צריך לראות את הלוגים + התראה כתומה
