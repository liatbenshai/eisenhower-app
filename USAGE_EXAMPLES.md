# 📘 דוגמאות שימוש - מערכת סיווג משימות ולמידה

## תוכן עניינים
1. [שימוש בסיסי](#שימוש-בסיסי)
2. [חיזוי זמנים](#חיזוי-זמנים)
3. [קבלת תובנות](#קבלת-תובנות)
4. [שימוש מתקדם](#שימוש-מתקדם)

---

## שימוש בסיסי

### יצירת משימה עם סוג

```javascript
import { useTasks } from './hooks/useTasks';
import { TASK_CATEGORIES } from './utils/taskCategories';

function CreateTask() {
  const { addTask } = useTasks();
  
  const handleSubmit = async () => {
    await addTask({
      title: 'תמלול הרצאה',
      description: 'תמלול ההרצאה מאתמול',
      quadrant: 2,
      dueDate: '2024-12-20',
      estimatedDuration: 60,
      taskType: 'transcription' // 🎙️ סוג המשימה
    });
  };
}
```

### זיהוי אוטומטי של סוג משימה

```javascript
import { detectTaskCategory } from './utils/taskCategories';

const task = {
  title: 'לתמלל את הפגישה עם הלקוח',
  description: 'צריך להקליד את ההקלטה'
};

const detection = detectTaskCategory(task);
console.log(detection);
// {
//   category: { id: 'transcription', name: 'תמלול', icon: '🎙️', ... },
//   confidence: 75,
//   detectedKeywords: ['תמלל', 'הקלטה']
// }
```

### קבלת מידע על קטגוריה

```javascript
import { getCategoryById, TASK_CATEGORIES } from './utils/taskCategories';

// לפי ID
const category = getCategoryById('transcription');
console.log(category.name); // 'תמלול'
console.log(category.typicalDuration); // 60 דקות
console.log(category.bestTimeOfDay); // 'morning'

// כל הקטגוריות
Object.values(TASK_CATEGORIES).forEach(cat => {
  console.log(`${cat.icon} ${cat.name} - ${cat.typicalDuration} דקות`);
});
```

---

## חיזוי זמנים

### חיזוי זמן למשימה חדשה

```javascript
import { predictTaskDuration } from './utils/taskTypeLearning';
import { useAuth } from './hooks/useAuth';

async function PredictTime() {
  const { user } = useAuth();
  
  const prediction = await predictTaskDuration(
    user.id,
    'transcription',
    {
      quadrant: 2,
      title: 'תמלול הרצאה ארוכה',
      description: 'הרצאה של שעתיים'
    }
  );
  
  console.log(prediction);
  // {
  //   predictedTime: 47,
  //   confidence: 'high',
  //   reason: 'ממוצע של 12 משימות קודמות',
  //   basedOn: 'history',
  //   stats: {
  //     totalTasks: 12,
  //     averageTime: 47,
  //     accuracy: 85,
  //     minTime: 30,
  //     maxTime: 90
  //   }
  // }
}
```

### שימוש בחיזוי בטופס

```javascript
import { useState, useEffect } from 'react';
import { predictTaskDuration } from './utils/taskTypeLearning';

function TaskForm() {
  const [taskType, setTaskType] = useState('transcription');
  const [prediction, setPrediction] = useState(null);
  const { user } = useAuth();
  
  useEffect(() => {
    if (taskType && user?.id) {
      predictTaskDuration(user.id, taskType).then(pred => {
        setPrediction(pred);
      });
    }
  }, [taskType, user?.id]);
  
  return (
    <div>
      {prediction && (
        <div className={`alert ${
          prediction.confidence === 'high' ? 'alert-success' :
          prediction.confidence === 'medium' ? 'alert-warning' :
          'alert-info'
        }`}>
          <h4>🤖 חיזוי חכם: {prediction.predictedTime} דקות</h4>
          <p>{prediction.reason}</p>
          {prediction.stats && (
            <small>
              דיוק היסטורי: {prediction.stats.accuracy}%
            </small>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## קבלת תובנות

### תובנות לסוג משימה ספציפי

```javascript
import { getTaskTypeInsights } from './utils/taskTypeLearning';

async function ShowInsights() {
  const insights = await getTaskTypeInsights(userId, 'transcription');
  
  if (!insights.hasData) {
    console.log('עדיין אין מספיק נתונים');
    return;
  }
  
  insights.insights.forEach(insight => {
    console.log(`${insight.icon} ${insight.title}`);
    console.log(`   ${insight.message}`);
    
    // סוגי תובנות אפשריים:
    // - best_day: היום הכי פרודוקטיבי
    // - best_hour: השעה הכי טובה
    // - trend: מגמת שיפור
    // - consistency: עקביות בזמנים
  });
}
```

### סיכום כל סוגי המשימות

```javascript
import { getTaskTypeSummary } from './utils/taskTypeLearning';

async function ShowSummary() {
  const summary = await getTaskTypeSummary(userId);
  
  console.log('סה"כ משימות:', summary.totals.totalTasks);
  console.log('סה"כ זמן עבודה:', summary.totals.totalTime, 'דקות');
  console.log('דיוק ממוצע:', summary.totals.averageAccuracy, '%');
  
  // הסוג הכי נפוץ
  if (summary.mostCommon) {
    console.log(
      'הכי הרבה עובד על:',
      summary.mostCommon.category.name,
      `(${summary.mostCommon.totalTasks} משימות)`
    );
  }
  
  // הסוג הכי מדויק
  if (summary.mostAccurate) {
    console.log(
      'הכי מדויק ב:',
      summary.mostAccurate.category.name,
      `(${summary.mostAccurate.accuracy}% דיוק)`
    );
  }
  
  // פירוט לכל סוג
  summary.summary.forEach(item => {
    console.log(`\n${item.category.icon} ${item.category.name}`);
    console.log(`  משימות: ${item.totalTasks}`);
    console.log(`  זמן ממוצע: ${item.averageTime} דקות`);
    console.log(`  דיוק: ${item.accuracy}%`);
  });
}
```

### קבלת המלצות

```javascript
import { getTimeManagementRecommendations } from './utils/taskTypeLearning';

async function ShowRecommendations() {
  const recommendations = await getTimeManagementRecommendations(userId);
  
  recommendations.forEach(rec => {
    // סוגי המלצות:
    // - low_accuracy: דיוק נמוך
    // - time_consuming: משימות שלוקחות הרבה זמן
    // - diversify: צריך לסווג יותר
    // - excellent: הכל טוב!
    
    console.log(`${rec.icon} ${rec.title}`);
    console.log(`   ${rec.message}`);
    console.log(`   עדיפות: ${rec.priority}`);
    console.log(`   פעולה: ${rec.action}`);
  });
}
```

---

## שימוש מתקדם

### קבלת סטטיסטיקות ישירות מהמסד

```javascript
import { supabase } from './services/supabase';

// סטטיסטיקות לסוג משימה
async function getStats(userId, taskType) {
  const { data, error } = await supabase
    .from('task_type_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('task_type', taskType)
    .single();
    
  return data;
}

// היסטוריה אחרונה
async function getRecentHistory(userId, limit = 10) {
  const { data, error } = await supabase
    .from('task_completion_history')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);
    
  return data;
}
```

### חישוב אחוז דיוק

```javascript
function calculateAccuracy(estimated, actual) {
  if (estimated === 0) return 0;
  
  const diff = Math.abs(actual - estimated);
  const accuracy = 100 - (diff * 100 / Math.max(estimated, actual));
  
  return Math.max(0, Math.round(accuracy));
}

// דוגמה
console.log(calculateAccuracy(60, 50)); // 83% - די מדויק
console.log(calculateAccuracy(60, 120)); // 50% - לא מדויק
console.log(calculateAccuracy(60, 62)); // 97% - מאוד מדויק
```

### ניתוח התפלגות משימות

```javascript
import { analyzeCategoryDistribution } from './utils/taskCategories';

function AnalyzeTasks({ tasks }) {
  const analysis = analyzeCategoryDistribution(tasks);
  
  console.log('סה"כ משימות:', analysis.total);
  console.log('הקטגוריה הכי נפוצה:', analysis.mostCommon?.name);
  
  Object.values(analysis.distribution).forEach(cat => {
    console.log(`\n${cat.category.icon} ${cat.category.name}`);
    console.log(`  כמות: ${cat.count} (${cat.percentage}%)`);
    console.log(`  זמן כולל: ${cat.totalTime} דקות`);
    console.log(`  זמן ממוצע: ${cat.averageTime} דקות`);
  });
}
```

### מציאת זמן אופטימלי למשימה

```javascript
import { getOptimalTimeForCategory } from './utils/taskCategories';

// בלי דפוסי עבודה (ברירת מחדל)
const optimalHour = getOptimalTimeForCategory('transcription');
console.log(optimalHour); // 9 (בוקר)

// עם דפוסי עבודה
const workPatterns = {
  hourPatterns: {
    8: { productivity: 75 },
    9: { productivity: 85 },
    10: { productivity: 95 }, // השעה הכי פרודוקטיבית
    11: { productivity: 90 },
    14: { productivity: 70 }
  }
};

const bestHour = getOptimalTimeForCategory('transcription', workPatterns);
console.log(bestHour); // 10 (השעה הכי טובה במסגרת הבוקר)
```

### שילוב עם טיימר

```javascript
import { useState, useEffect } from 'react';
import { updateTask } from './services/supabase';

function TaskTimer({ task, onUpdate }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  // עדכון אוטומטי כל 5 דקות
  useEffect(() => {
    if (isRunning && elapsedSeconds > 0 && elapsedSeconds % 300 === 0) {
      saveProgress();
    }
  }, [elapsedSeconds, isRunning]);
  
  const saveProgress = async () => {
    const minutesToAdd = Math.floor(elapsedSeconds / 60);
    if (minutesToAdd > 0) {
      await updateTask(task.id, {
        time_spent: (task.time_spent || 0) + minutesToAdd
      });
      onUpdate();
    }
  };
  
  // כשמסיימים את המשימה
  const completeTask = async () => {
    await saveProgress();
    await updateTask(task.id, { is_completed: true });
    // הטריגר במסד הנתונים יעדכן אוטומטית את הסטטיסטיקות!
  };
}
```

### יצירת דוח מותאם אישית

```javascript
import { 
  getTaskTypeSummary, 
  getTimeManagementRecommendations 
} from './utils/taskTypeLearning';

async function generateWeeklyReport(userId) {
  const [summary, recommendations] = await Promise.all([
    getTaskTypeSummary(userId),
    getTimeManagementRecommendations(userId)
  ]);
  
  const report = {
    period: 'שבוע זה',
    totalTasks: summary.totals.totalTasks,
    totalHours: Math.round(summary.totals.totalTime / 60),
    accuracy: summary.totals.averageAccuracy,
    topCategory: summary.mostCommon?.category.name,
    recommendations: recommendations.map(r => ({
      title: r.title,
      message: r.message,
      priority: r.priority
    }))
  };
  
  return report;
}
```

---

## טיפים למפתחים

### 1. Cache תוצאות
חיזויים וסטטיסטיקות לא משתנים כל שניה - שמור אותם ב-state:

```javascript
const [predictions, setPredictions] = useState({});

const getPrediction = async (taskType) => {
  if (predictions[taskType]) {
    return predictions[taskType];
  }
  
  const pred = await predictTaskDuration(userId, taskType);
  setPredictions(prev => ({ ...prev, [taskType]: pred }));
  return pred;
};
```

### 2. טיפול בשגיאות
תמיד עטוף בקריאות ב-try-catch:

```javascript
try {
  const prediction = await predictTaskDuration(userId, taskType);
  // השתמש בחיזוי
} catch (error) {
  console.error('שגיאה בחיזוי:', error);
  // השתמש בערך ברירת מחדל
  const category = getCategoryById(taskType);
  return { predictedTime: category?.typicalDuration || 30 };
}
```

### 3. אופטימיזציה
השתמש ב-React Query או SWR לניהול state:

```javascript
import { useQuery } from 'react-query';

function useTaskTypeSummary(userId) {
  return useQuery(
    ['taskTypeSummary', userId],
    () => getTaskTypeSummary(userId),
    {
      staleTime: 5 * 60 * 1000, // 5 דקות
      cacheTime: 10 * 60 * 1000 // 10 דקות
    }
  );
}
```

---

**זקוק לעזרה נוספת?**  
ראה את התיעוד המלא ב-`TASK_TYPE_SYSTEM.md`

