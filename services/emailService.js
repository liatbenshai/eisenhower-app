/**
 * שירות שליחת מיילים
 * משתמש ב-Supabase Edge Functions + Resend
 */

import { supabase } from './supabase';

// תבניות מייל בעברית
const EMAIL_TEMPLATES = {
  // תזכורת משימה
  taskReminder: (taskTitle, dueDate, dueTime) => ({
    subject: `תזכורת: ${taskTitle}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">⏰ תזכורת משימה</h2>
        <p>שלום,</p>
        <p>זוהי תזכורת למשימה שהגדרת:</p>
        <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #1F2937;">${taskTitle}</h3>
          <p style="margin: 0; color: #6B7280;">
            📅 תאריך יעד: ${dueDate}
            ${dueTime ? `<br>🕐 שעה: ${dueTime}` : ''}
          </p>
        </div>
        <a href="${window.location.origin}/dashboard" 
           style="display: inline-block; background: #3B82F6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
          צפה במשימות שלך
        </a>
        <p style="color: #9CA3AF; font-size: 14px; margin-top: 20px;">
          מטריצת אייזנהאואר - ניהול זמן חכם
        </p>
      </div>
    ` 
  }),

  // סיכום יומי
  dailySummary: (tasks) => {
    const urgentTasks = tasks.filter(t => t.quadrant === 1 && !t.is_completed);
    const importantTasks = tasks.filter(t => t.quadrant === 2 && !t.is_completed);
    
    return {
      subject: '📋 סיכום יומי - המשימות שלך להיום',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B82F6;">☀️ בוקר טוב!</h2>
          <p>הנה סיכום המשימות שלך להיום:</p>
          
          ${urgentTasks.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #EF4444;">🔴 דחוף וחשוב - עשה עכשיו</h3>
              <ul style="padding-right: 20px;">
                ${urgentTasks.map(t => `<li>${t.title}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${importantTasks.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #3B82F6;">🔵 חשוב - תכנן</h3>
              <ul style="padding-right: 20px;">
                ${importantTasks.map(t => `<li>${t.title}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${urgentTasks.length === 0 && importantTasks.length === 0 ? `
            <p style="color: #10B981;">✨ אין משימות דחופות או חשובות - יום מעולה!</p>
          ` : ''}
          
          <a href="${window.location.origin}/dashboard" 
             style="display: inline-block; background: #3B82F6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 15px;">
            פתח את לוח המשימות
          </a>
          
          <p style="color: #9CA3AF; font-size: 14px; margin-top: 20px;">
            מטריצת אייזנהאואר - ניהול זמן חכם
          </p>
        </div>
      `
    };
  },

  // ברוכים הבאים
  welcome: (fullName) => ({
    subject: 'ברוכים הבאים למטריצת אייזנהאואר!',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">🎉 שלום ${fullName}!</h2>
        <p>ברוכים הבאים למטריצת אייזנהאואר - הכלי שיעזור לך לנהל את הזמן שלך בצורה חכמה.</p>
        
        <h3>איך זה עובד?</h3>
        <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><span style="color: #EF4444;">🔴 דחוף וחשוב</span> - עשה עכשיו</p>
          <p><span style="color: #3B82F6;">🔵 חשוב אך לא דחוף</span> - תכנן</p>
          <p><span style="color: #F97316;">🟠 דחוף אך לא חשוב</span> - האצל</p>
          <p><span style="color: #6B7280;">⚫ לא דחוף ולא חשוב</span> - בטל</p>
        </div>
        
        <a href="${window.location.origin}/dashboard" 
           style="display: inline-block; background: #3B82F6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
          התחל עכשיו
        </a>
        
        <p style="color: #9CA3AF; font-size: 14px; margin-top: 20px;">
          בהצלחה!<br>
          צוות מטריצת אייזנהאואר
        </p>
      </div>
    `
  })
};

/**
 * שליחת מייל דרך Edge Function
 */
export async function sendEmail(to, template, templateData) {
  try {
    const emailContent = EMAIL_TEMPLATES[template](...templateData);
    
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject: emailContent.subject,
        html: emailContent.html
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('שגיאה בשליחת מייל:', error);
    throw error;
  }
}

/**
 * שליחת תזכורת משימה
 */
export async function sendTaskReminder(email, taskTitle, dueDate, dueTime) {
  return sendEmail(email, 'taskReminder', [taskTitle, dueDate, dueTime]);
}

/**
 * שליחת סיכום יומי
 */
export async function sendDailySummary(email, tasks) {
  return sendEmail(email, 'dailySummary', [tasks]);
}

/**
 * שליחת מייל ברוכים הבאים
 */
export async function sendWelcomeEmail(email, fullName) {
  return sendEmail(email, 'welcome', [fullName]);
}

export default {
  sendEmail,
  sendTaskReminder,
  sendDailySummary,
  sendWelcomeEmail
};

