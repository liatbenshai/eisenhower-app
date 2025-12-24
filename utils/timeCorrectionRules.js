/**
 * כלי עזר לעבודה עם כללי תיקון זמן
 */

import { supabase } from '../services/supabase';

/**
 * קבלת כלל תיקון זמן לסוג משימה ספציפי
 */
export async function getCorrectionRule(userId, taskType) {
  try {
    const { data, error } = await supabase
      .from('time_correction_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('task_type', taskType)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }

    return data;
  } catch (err) {
    console.error('שגיאה בקבלת כלל תיקון:', err);
    return null;
  }
}

/**
 * קבלת כל כללי התיקון של המשתמש
 */
export async function getAllCorrectionRules(userId) {
  try {
    const { data, error } = await supabase
      .from('time_correction_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('task_type');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('שגיאה בקבלת כללי תיקון:', err);
    return [];
  }
}

/**
 * חישוב זמן מתוקן לפי כלל
 */
export function calculateCorrectedTime(estimatedMinutes, multiplier) {
  if (!estimatedMinutes || !multiplier) return estimatedMinutes;
  return Math.round(estimatedMinutes * multiplier);
}

/**
 * קבלת זמן מתוקן עם הסברים
 */
export async function getSuggestedTimeWithCorrection(userId, taskType, estimatedMinutes) {
  if (!userId || !taskType || !estimatedMinutes) {
    return {
      original: estimatedMinutes,
      corrected: estimatedMinutes,
      hasCorrection: false,
      rule: null
    };
  }

  const rule = await getCorrectionRule(userId, taskType);
  
  if (!rule) {
    return {
      original: estimatedMinutes,
      corrected: estimatedMinutes,
      hasCorrection: false,
      rule: null
    };
  }

  const correctedTime = calculateCorrectedTime(estimatedMinutes, rule.time_multiplier);
  
  return {
    original: estimatedMinutes,
    corrected: correctedTime,
    hasCorrection: true,
    rule: rule,
    explanation: rule.notes || `המערכת לומדת שמשימות מסוג זה לוקחות בממוצע פי ${rule.time_multiplier} מהזמן המשוער`
  };
}

/**
 * עדכון מונה השימוש בכלל
 */
export async function markRuleAsApplied(userId, taskType, wasAccepted = true) {
  try {
    const { error } = await supabase.rpc('increment_rule_usage', {
      p_user_id: userId,
      p_task_type: taskType,
      p_accepted: wasAccepted
    });

    if (error) {
      // אם הפונקציה לא קיימת, נעדכן ישירות
      const updateData = wasAccepted
        ? { 
            times_applied: supabase.raw('times_applied + 1'),
            times_accepted: supabase.raw('times_accepted + 1')
          }
        : { 
            times_applied: supabase.raw('times_applied + 1')
          };

      await supabase
        .from('time_correction_rules')
        .update(updateData)
        .eq('user_id', userId)
        .eq('task_type', taskType);
    }
  } catch (err) {
    console.error('שגיאה בעדכון שימוש בכלל:', err);
  }
}

/**
 * יצירת או עדכון כלל תיקון
 */
export async function upsertCorrectionRule(userId, taskType, multiplier, notes = null) {
  try {
    const { data, error } = await supabase
      .from('time_correction_rules')
      .upsert({
        user_id: userId,
        task_type: taskType,
        time_multiplier: multiplier,
        notes: notes,
        is_active: true,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id,task_type'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('שגיאה ביצירת כלל:', err);
    throw err;
  }
}

/**
 * מחיקת כלל תיקון
 */
export async function deleteCorrectionRule(userId, taskType) {
  try {
    const { error } = await supabase
      .from('time_correction_rules')
      .delete()
      .eq('user_id', userId)
      .eq('task_type', taskType);

    if (error) throw error;
  } catch (err) {
    console.error('שגיאה במחיקת כלל:', err);
    throw err;
  }
}

export default {
  getCorrectionRule,
  getAllCorrectionRules,
  calculateCorrectedTime,
  getSuggestedTimeWithCorrection,
  markRuleAsApplied,
  upsertCorrectionRule,
  deleteCorrectionRule
};

