/**
 * סקריפט לעדכון זמן שבוצע למשימה
 * שימוש: node scripts/update-time.js "שם המשימה" שעות דקות
 * דוגמה: node scripts/update-time.js "בית חולים יוספטל" 5 30
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// טעינת משתני סביבה
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ שגיאה: יש להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY ב-.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateTaskTime(taskTitle, hours, minutes) {
  const totalMinutes = hours * 60 + minutes;
  
  console.log(`🔍 מחפש משימה: "${taskTitle}"`);
  
  // קבלת המשתמש הנוכחי (צריך להתחבר ראשית)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.user) {
    console.error('❌ שגיאה: יש להתחבר ראשית');
    console.log('💡 פתרון: פתחי את האפליקציה בדפדפן והתחברי, אחר כך הרצי את הסקריפט');
    process.exit(1);
  }

  console.log(`✅ מחובר כמשתמש: ${session.user.email}`);

  // חיפוש המשימה
  const { data: tasks, error: searchError } = await supabase
    .from('tasks')
    .select('id, title, time_spent')
    .eq('user_id', session.user.id)
    .ilike('title', `%${taskTitle}%`);

  if (searchError) {
    console.error('❌ שגיאה בחיפוש:', searchError);
    process.exit(1);
  }

  if (!tasks || tasks.length === 0) {
    console.error(`❌ לא נמצאה משימה עם השם "${taskTitle}"`);
    process.exit(1);
  }

  if (tasks.length > 1) {
    console.warn(`⚠️ נמצאו ${tasks.length} משימות עם השם "${taskTitle}":`);
    tasks.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.title} (ID: ${t.id}, זמן נוכחי: ${t.time_spent || 0} דקות)`);
    });
    console.log(`📝 מעדכן את הראשונה: ${tasks[0].title}`);
  }

  const task = tasks[0];
  console.log(`\n📋 משימה: ${task.title}`);
  console.log(`   ID: ${task.id}`);
  console.log(`   זמן נוכחי: ${task.time_spent || 0} דקות`);
  console.log(`   זמן חדש: ${totalMinutes} דקות (${hours} שעות ${minutes} דקות)`);

  // עדכון הזמן
  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update({ 
      time_spent: totalMinutes,
      updated_at: new Date().toISOString()
    })
    .eq('id', task.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ שגיאה בעדכון:', updateError);
    process.exit(1);
  }

  console.log('\n✅ זמן עודכן בהצלחה!');
  console.log(`   זמן עדכני: ${updatedTask.time_spent} דקות`);
  console.log(`\n💡 טיפ: רענני את הדף כדי לראות את השינויים`);
}

// קריאת הפרמטרים
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('שימוש: node scripts/update-time.js "שם המשימה" שעות דקות');
  console.log('דוגמה: node scripts/update-time.js "בית חולים יוספטל" 5 30');
  process.exit(1);
}

const taskTitle = args[0];
const hours = parseInt(args[1]) || 0;
const minutes = parseInt(args[2]) || 0;

if (hours === 0 && minutes === 0) {
  console.error('❌ שגיאה: יש להזין לפחות שעה או דקה');
  process.exit(1);
}

updateTaskTime(taskTitle, hours, minutes).catch(err => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});

