# הוראות התקנה והגדרה

## שלב 1: התקנת תלויות
```bash
npm install
```

## שלב 2: הגדרת Supabase

### א. יצירת פרויקט Supabase
1. היכנס ל-[Supabase](https://supabase.com) וצור חשבון (אם אין לך)
2. צור פרויקט חדש
3. העתק את ה-URL וה-Anon Key מההגדרות

### ב. יצירת קובץ .env
צור קובץ בשם `.env` בתיקיית השורש של הפרויקט עם התוכן הבא:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**חשוב:** החלף את `your-project-id` ו-`your-anon-key-here` בערכים האמיתיים שלך מ-Supabase.

### ג. הרצת מיגרציות
1. פתח את ה-SQL Editor ב-Supabase
2. הרץ את כל קבצי המיגרציה בסדר:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_add_subtasks.sql`
   - `supabase/migrations/003_add_progress_tracking.sql`
   - `supabase/migrations/004_add_time_tracking_to_tasks.sql`
   - `supabase/migrations/005_add_task_templates.sql`
   - `supabase/migrations/006_add_time_blocks.sql`

## שלב 3: הרצת האפליקציה

```bash
npm run dev
```

האפליקציה תיפתח בכתובת: `http://localhost:5173`

## פתרון בעיות

### האפליקציה לא נפתחת
1. ודא שהתקנת את כל התלויות: `npm install`
2. ודא שיצרת קובץ `.env` עם הערכים הנכונים
3. בדוק את הקונסול בדפדפן (F12) לשגיאות
4. ודא שהמיגרציות רצו בהצלחה ב-Supabase

### שגיאת חיבור ל-Supabase
- ודא שה-URL וה-Anon Key נכונים בקובץ `.env`
- ודא שהפרויקט ב-Supabase פעיל
- בדוק את ה-API Settings ב-Supabase

### שגיאות במיגרציות
- ודא שאתה מריץ את המיגרציות בסדר הנכון
- בדוק אם יש שגיאות ב-SQL Editor
- ודא שיש לך הרשאות מתאימות בפרויקט

