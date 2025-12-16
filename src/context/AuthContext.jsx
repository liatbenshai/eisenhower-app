import { createContext, useState, useEffect } from 'react';
import { supabase, getCurrentUser, signIn, signUp, signOut, resetPassword } from '../services/supabase';

// יצירת קונטקסט
export const AuthContext = createContext(null);

/**
 * ספק אותנטיקציה
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // האזנה לשינויים באותנטיקציה
  useEffect(() => {
    // בדיקת משתמש נוכחי
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error('שגיאה בבדיקת משתמש:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // האזנה לשינויי אותנטיקציה
    let subscription = null;
    try {
      const authStateChange = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            try {
              const currentUser = await getCurrentUser();
              setUser(currentUser);
            } catch (err) {
              console.error('שגיאה בטעינת משתמש:', err);
              setUser(null);
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        }
      );
      subscription = authStateChange?.data?.subscription;
    } catch (err) {
      console.error('שגיאה בהגדרת האזנה לאותנטיקציה:', err);
      setLoading(false);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // התחברות
  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const data = await signIn(email, password);
      
      // בדיקה אם המשתמש פעיל
      if (data.user?.profile?.is_active === false) {
        await signOut();
        throw new Error('החשבון שלך הושהה. פנה למנהל המערכת.');
      }
      
      return data;
    } catch (err) {
      const message = translateAuthError(err.message);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // הרשמה
  const register = async (email, password, fullName) => {
    setError(null);
    setLoading(true);
    try {
      const data = await signUp(email, password, fullName);
      return data;
    } catch (err) {
      const message = translateAuthError(err.message);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // התנתקות
  const logout = async () => {
    setError(null);
    try {
      await signOut();
      setUser(null);
    } catch (err) {
      setError('שגיאה בהתנתקות');
      throw err;
    }
  };

  // שכחתי סיסמה
  const forgotPassword = async (email) => {
    setError(null);
    try {
      await resetPassword(email);
    } catch (err) {
      const message = translateAuthError(err.message);
      setError(message);
      throw new Error(message);
    }
  };

  // בדיקה אם המשתמש הוא מנהל
  const isAdmin = () => {
    return user?.profile?.role === 'super_admin';
  };

  // ניקוי שגיאה
  const clearError = () => setError(null);

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    forgotPassword,
    isAdmin,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * תרגום שגיאות אותנטיקציה לעברית
 */
function translateAuthError(message) {
  const translations = {
    'Invalid login credentials': 'פרטי התחברות שגויים',
    'Email not confirmed': 'האימייל לא אומת. בדוק את תיבת הדואר שלך',
    'User already registered': 'המשתמש כבר קיים במערכת',
    'Password should be at least 6 characters': 'הסיסמה חייבת להכיל לפחות 6 תווים',
    'Unable to validate email address: invalid format': 'כתובת אימייל לא תקינה',
    'Email rate limit exceeded': 'נשלחו יותר מדי בקשות. נסה שוב מאוחר יותר',
    'Network error': 'שגיאת רשת. בדוק את החיבור לאינטרנט'
  };

  return translations[message] || message || 'שגיאה לא צפויה';
}

export default AuthContext;

