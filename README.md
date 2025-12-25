# עדכון מערכת פיצול משימות + התראות חפיפות
## תאריך: December 2025

---

## קבצים לעדכון

```
src/utils/smartTaskSplitter.js    ← החלף
src/utils/urgentRescheduler.js    ← החלף
src/utils/timeOverlap.js          ← החלף (חשוב!)
src/components/Tasks/TaskForm.jsx ← החלף
src/components/Tasks/ScheduleConflictAlert.jsx ← הוסף (חדש!)
utils/smartTaskSplitter.js        ← החלף
```

---

## Debug Mode

הגרסה כוללת לוגים ב-Console (F12):
- `🔍 בדיקת חפיפות:` - מראה את המשימות והפורמט שלהן
- `🔄 תוצאת חפיפות:` - מה נמצא
- `⚠️ נמצאה חפיפה!` - כשיש התנגשות

---

## בדיקה

1. פתחי F12 > Console לפני הוספת משימה
2. הוסיפי משימה עם תאריך ושעה ומשך זמן
3. הוסיפי משימה נוספת באותו זמן
4. צריך לראות את הלוגים + התראה כתומה
