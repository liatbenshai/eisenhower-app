# מטריצת אייזנהאואר 📊

אפליקציית ניהול זמן מבוססת מטריצת אייזנהאואר - עוזרת לך לתעדף משימות לפי דחיפות וחשיבות.

![Screenshot](screenshot.png)

## ✨ תכונות

- **מטריצת 4 רבעים** - ניהול משימות לפי דחיפות וחשיבות
- **גרירה ושחרור** - העבר משימות בין רבעים בקלות
- **תזכורות** - התראות Push ומייל לפני משימות
- **ייצוא** - PDF, Excel ו-CSV עם תמיכה בעברית
- **מצב כהה/בהיר** - עיצוב נוח לעיניים
- **PWA** - עובד גם אופליין
- **רספונסיבי** - מותאם לנייד ודסקטופ
- **פאנל ניהול** - למנהלי המערכת

## 🚀 התקנה

### דרישות מקדימות

- Node.js 18+
- חשבון [Supabase](https://supabase.com)

### התקנה מקומית

```bash
# שכפול הפרויקט
git clone https://github.com/your-username/eisenhower-app.git
cd eisenhower-app

# התקנת תלויות
npm install

# יצירת קובץ סביבה
cp .env.example .env
```

### הגדרת Supabase

1. צור פרויקט חדש ב-[Supabase](https://supabase.com)
2. העתק את ה-URL ו-anon key לקובץ `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. הרץ את סקריפט המיגרציה ב-SQL Editor:

```sql
-- העתק את התוכן מ-supabase/migrations/001_initial_schema.sql
```

### הרצה

```bash
# מצב פיתוח
npm run dev

# בנייה לייצור
npm run build

# תצוגה מקדימה
npm run preview
```

## 📁 מבנה הפרויקט

```
eisenhower-app/
├── src/
│   ├── components/     # רכיבי React
│   │   ├── Matrix/     # מטריצה ורבעים
│   │   ├── Tasks/      # ניהול משימות
│   │   ├── Layout/     # פריסה וניווט
│   │   ├── Auth/       # אותנטיקציה
│   │   ├── Admin/      # פאנל ניהול
│   │   ├── Export/     # ייצוא נתונים
│   │   ├── Notifications/  # התראות
│   │   └── UI/         # רכיבי UI כלליים
│   ├── hooks/          # React Hooks מותאמים
│   ├── context/        # Context API
│   ├── services/       # שירותים חיצוניים
│   ├── utils/          # פונקציות עזר
│   ├── pages/          # דפי האפליקציה
│   └── styles/         # סגנונות CSS
├── public/             # קבצים סטטיים
└── supabase/           # מיגרציות מסד נתונים
```

## 🎨 הרבעים

| רבע | שם | צבע | פעולה |
|-----|-----|-----|-------|
| 1 | דחוף וחשוב | 🔴 אדום | עשה עכשיו |
| 2 | חשוב אך לא דחוף | 🔵 כחול | תכנן |
| 3 | דחוף אך לא חשוב | 🟠 כתום | האצל |
| 4 | לא דחוף ולא חשוב | ⚫ אפור | בטל |

## 🔐 סוגי משתמשים

- **משתמש רגיל** - ניהול משימות אישיות
- **מנהל על** - גישה לפאנל ניהול, צפייה בכל המשתמשים

## 📱 PWA

האפליקציה תומכת בהתקנה כ-PWA:

1. פתח את האפליקציה בדפדפן Chrome/Edge
2. לחץ על "התקן" בשורת הכתובת
3. האפליקציה תופיע כאייקון בשולחן העבודה

## 🛠️ טכנולוגיות

- **React 18** - ספריית UI
- **Vite** - כלי בנייה
- **Tailwind CSS** - סגנונות
- **Supabase** - Backend as a Service
- **Framer Motion** - אנימציות
- **jsPDF** - ייצוא PDF
- **SheetJS** - ייצוא Excel

## 📄 רישיון

MIT License

## 👨‍💻 תרומה

תרומות מתקבלות בברכה! אנא פתחו Issue או Pull Request.

