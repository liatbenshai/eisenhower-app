/**
 * פונקציות אימות קלט
 */

/**
 * אימות כתובת אימייל
 */
export function validateEmail(email) {
  if (!email) {
    return { valid: false, message: 'נא להזין כתובת אימייל' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'כתובת אימייל לא תקינה' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות סיסמה
 */
export function validatePassword(password) {
  if (!password) {
    return { valid: false, message: 'נא להזין סיסמה' };
  }

  if (password.length < 6) {
    return { valid: false, message: 'הסיסמה חייבת להכיל לפחות 6 תווים' };
  }

  if (password.length > 72) {
    return { valid: false, message: 'הסיסמה ארוכה מדי (מקסימום 72 תווים)' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות התאמת סיסמאות
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return { valid: false, message: 'הסיסמאות אינן תואמות' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות שם מלא
 */
export function validateFullName(name) {
  if (!name) {
    return { valid: false, message: 'נא להזין שם מלא' };
  }

  if (name.length < 2) {
    return { valid: false, message: 'השם קצר מדי' };
  }

  if (name.length > 100) {
    return { valid: false, message: 'השם ארוך מדי' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות כותרת משימה
 */
export function validateTaskTitle(title) {
  if (!title) {
    return { valid: false, message: 'נא להזין כותרת למשימה' };
  }

  if (title.trim().length < 1) {
    return { valid: false, message: 'כותרת המשימה ריקה' };
  }

  if (title.length > 200) {
    return { valid: false, message: 'כותרת המשימה ארוכה מדי (מקסימום 200 תווים)' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות תיאור משימה
 */
export function validateTaskDescription(description) {
  if (description && description.length > 1000) {
    return { valid: false, message: 'התיאור ארוך מדי (מקסימום 1000 תווים)' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות רבע - אופציונלי
 */
export function validateQuadrant(quadrant) {
  // אם אין quadrant, זה תקין (אופציונלי)
  if (!quadrant || quadrant === null || quadrant === undefined) {
    return { valid: true, message: '' };
  }
  
  const validQuadrants = [1, 2, 3, 4];
  
  if (!validQuadrants.includes(quadrant)) {
    return { valid: false, message: 'רבע לא תקין' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות תאריך
 */
export function validateDate(dateString) {
  if (!dateString) {
    return { valid: true, message: '' }; // תאריך אופציונלי
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { valid: false, message: 'תאריך לא תקין' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות שעה
 */
export function validateTime(timeString) {
  if (!timeString) {
    return { valid: true, message: '' }; // שעה אופציונלית
  }

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(timeString)) {
    return { valid: false, message: 'שעה לא תקינה' };
  }

  return { valid: true, message: '' };
}

/**
 * אימות טופס התחברות
 */
export function validateLoginForm(data) {
  const errors = {};

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) errors.email = emailValidation.message;

  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) errors.password = passwordValidation.message;

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * אימות טופס הרשמה
 */
export function validateRegisterForm(data) {
  const errors = {};

  const nameValidation = validateFullName(data.fullName);
  if (!nameValidation.valid) errors.fullName = nameValidation.message;

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) errors.email = emailValidation.message;

  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) errors.password = passwordValidation.message;

  const matchValidation = validatePasswordMatch(data.password, data.confirmPassword);
  if (!matchValidation.valid) errors.confirmPassword = matchValidation.message;

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * אימות טופס משימה
 */
export function validateTaskForm(data) {
  const errors = {};

  const titleValidation = validateTaskTitle(data.title);
  if (!titleValidation.valid) errors.title = titleValidation.message;

  const descValidation = validateTaskDescription(data.description);
  if (!descValidation.valid) errors.description = descValidation.message;

  const quadrantValidation = validateQuadrant(data.quadrant);
  if (!quadrantValidation.valid) errors.quadrant = quadrantValidation.message;

  const dateValidation = validateDate(data.dueDate);
  if (!dateValidation.valid) errors.dueDate = dateValidation.message;

  const timeValidation = validateTime(data.dueTime);
  if (!timeValidation.valid) errors.dueTime = timeValidation.message;

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export default {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateFullName,
  validateTaskTitle,
  validateTaskDescription,
  validateQuadrant,
  validateDate,
  validateTime,
  validateLoginForm,
  validateRegisterForm,
  validateTaskForm
};

