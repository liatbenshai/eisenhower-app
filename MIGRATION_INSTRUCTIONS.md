# 🔧 הוראות הרצת Migration - מערכת למידה

## ⚠️ חשוב!

לפני שתשתמש במערכת החדשה, **חובה** להריץ את ה-migration שמוסיף את הטבלאות והשדות הדרושים למסד הנתונים.

## 📋 שלבי ההרצה

### שלב 1: היכנס ל-Supabase Dashboard

1. פתח דפדפן וגש ל: https://app.supabase.com
2. התחבר עם החשבון שלך
3. בחר את הפרויקט של אפליקציה זו

### שלב 2: פתח את ה-SQL Editor

1. בתפריט הצד, לחץ על **"SQL Editor"** (📝)
2. לחץ על הכפתור **"+ New Query"** (למעלה משמאל)

### שלב 3: העתק את ה-Migration

1. פתח את הקובץ:  
   `supabase/migrations/007_add_task_types_and_learning.sql`
   
2. **העתק את כל התוכן** (Ctrl+A, Ctrl+C)

3. **הדבק** בחלון ה-SQL Editor ב-Supabase (Ctrl+V)

### שלב 4: הרץ את ה-Migration

1. לחץ על **"Run"** (או לחץ Ctrl+Enter)
2. המערכת תריץ את כל הפקודות
3. אם הכל עבר בהצלחה, תראה הודעה ירוקה: **"Success. No rows returned"**

### שלב 5: אימות

בדוק שהכל עבד:

#### בדיקה 1: טבלת tasks
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'task_type';
```
**תוצאה צפויה:** שורה אחת עם `task_type | text`

#### בדיקה 2: טבלת task_type_stats
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'task_type_stats';
```
**תוצאה צפויה:** `1`

#### בדיקה 3: טבלת task_completion_history
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'task_completion_history';
```
**תוצאה צפויה:** `1`

#### בדיקה 4: הטריגר
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'update_task_type_stats_trigger';
```
**תוצאה צפויה:** שורה עם `update_task_type_stats_trigger`

## ✅ סיימת!

אם כל הבדיקות עברו בהצלחה, המערכת מוכנה לשימוש!

עכשיו אתה יכול:
1. לרענן את האפליקציה (F5)
2. ליצור משימה חדשה עם סוג משימה
3. להתחיל להשתמש במערכת הלמידה

## 🐛 פתרון בעיות

### שגיאה: "relation already exists"
**משמעות:** ה-migration כבר רץ בעבר.  
**פתרון:** זה בסדר! אין צורך לעשות כלום.

### שגיאה: "column task_type already exists"
**משמעות:** השדה כבר קיים בטבלה.  
**פתרון:** זה בסדר! המערכת מוכנה לשימוש.

### שגיאה: "permission denied"
**משמעות:** אין לך הרשאות מספיקות.  
**פתרון:** 
1. ודא שאתה מחובר כבעלים של הפרויקט
2. נסה להריץ שוב
3. אם זה לא עובד, פנה לתמיכה של Supabase

### שגיאה: "syntax error"
**משמעות:** יש בעיה בקוד ש-SQL.  
**פתרון:**
1. ודא שהעתקת את **כל** התוכן של הקובץ
2. ודא שלא העתקת כפול
3. נסה להעתיק שוב מההתחלה

### שגיאה אחרת
1. צלם screenshot של השגיאה
2. העתק את הודעת השגיאה
3. פתח issue ב-GitHub או צור קשר עם התמיכה

## 📝 מה ה-Migration עושה?

### מוסיף שדה חדש
- `task_type` בטבלת `tasks` - שומר את סוג המשימה

### יוצר טבלאות חדשות
- `task_type_stats` - סטטיסטיקות מצטברות לכל סוג משימה
- `task_completion_history` - היסטוריה מלאה של משימות שהושלמו

### יוצר טריגר אוטומטי
- כשמשימה מסומנת כהושלמה, הטריגר:
  1. מחשב אחוז דיוק
  2. מוסיף רשומה להיסטוריה
  3. מעדכן סטטיסטיקות

### מגדיר הרשאות (RLS)
- כל משתמש רואה רק את הנתונים שלו
- מנהלים יכולים לראות סטטיסטיקות כלליות

## 🔄 צריך לבטל?

אם בכל מקרה תרצה לבטל את המערכת (לא מומלץ!):

```sql
-- הסרת הטריגר
DROP TRIGGER IF EXISTS update_task_type_stats_trigger ON public.tasks;
DROP FUNCTION IF EXISTS public.update_task_type_stats();

-- מחיקת הטבלאות
DROP TABLE IF EXISTS public.task_completion_history;
DROP TABLE IF EXISTS public.task_type_stats;

-- הסרת השדה
ALTER TABLE public.tasks DROP COLUMN IF EXISTS task_type;
```

**אזהרה:** זה ימחק את כל הנתונים שנאספו!

## 💡 טיפ

אם אתה עובד עם Git ו-Supabase CLI, אתה יכול להריץ:

```bash
supabase db reset
supabase migration up
```

זה יריץ את כל ה-migrations אוטומטית.

---

**זקוק לעזרה?** פנה לתיעוד הטכני ב-`TASK_TYPE_SYSTEM.md`

