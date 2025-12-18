import { createContext, useState, useEffect, useRef } from 'react';
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
  const userRef = useRef(null); // שמירת user ב-ref למניעת stale closures

  // Wrapper function לעדכון user - מעדכן גם את ה-state וגם את ה-ref
  const updateUser = (newUser) => {
    setUser(newUser);
    userRef.current = newUser;
  };

  // האזנה לשינויים באותנטיקציה
  useEffect(() => {
    let mounted = true;
    let subscription = null;
    let sessionCheckInterval = null;
    let visibilityHandler = null;

    // טעינת משתמש ראשונית - בדיקת סשן קיים
    const initializeAuth = async () => {
      try {
        // קבלת סשן קיים
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('שגיאה בקבלת סשן:', sessionError);
          if (mounted) {
            updateUser(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          try {
            const currentUser = await getCurrentUser();
            if (mounted) {
            updateUser(currentUser);
            }
          } catch (err) {
            console.error('שגיאה בטעינת פרטי משתמש:', err);
            // אם יש שגיאה בטעינת הפרופיל, נשתמש במשתמש הבסיסי
            if (mounted) {
              updateUser(session.user);
            }
          }
        } else {
          if (mounted) {
            updateUser(null);
          }
        }
      } catch (err) {
        console.error('שגיאה באתחול אותנטיקציה:', err);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // בדיקת תקינות סשן כל 5 דקות
    const checkSession = async () => {
      if (!mounted) return;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('⚠️ שגיאה בבדיקת סשן:', error);
          return;
        }
        
        const currentUser = userRef.current;
        if (!session && currentUser) {
          console.warn('⚠️ סשן פג, מנתק משתמש');
          if (mounted) {
            updateUser(null);
          }
        } else if (session && !currentUser) {
          console.log('🔄 סשן נמצא, טוען משתמש מחדש');
          await initializeAuth();
        }
      } catch (err) {
        console.error('שגיאה בבדיקת סשן:', err);
      }
    };

    // טיפול ב-visibility change - כשהדפדפן חוזר להיות פעיל
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ דפדפן חזר להיות פעיל, בודק סשן...');
        checkSession();
      }
    };

    // אתחול ראשוני
    initializeAuth();
    
    // בדיקה תקופתית של הסשן (כל 5 דקות)
    sessionCheckInterval = setInterval(checkSession, 5 * 60 * 1000);
    
    // האזנה לשינויי visibility
    document.addEventListener('visibilitychange', visibilityHandler);

    // האזנה לשינויי אותנטיקציה
    try {
      const authStateChange = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;

          console.log('אירוע אותנטיקציה:', event, session ? 'יש סשן' : 'אין סשן');
          
          // התעלם מאירועים לא חשובים שלא צריכים לעדכן את המשתמש
          if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
            // רק עדכן את המשתמש אם יש סשן
            if (session?.user) {
              try {
                const currentUser = await getCurrentUser();
                if (mounted) {
                  setUser(currentUser);
                }
              } catch (err) {
                console.error('שגיאה בטעינת משתמש:', err);
                // אם יש שגיאה בטעינת הפרופיל, נשתמש במשתמש הבסיסי
                if (mounted) {
                  setUser(session.user);
                }
              }
            }
            return;
          }
          
          // רק עבור SIGNED_OUT - מחק את המשתמש
          if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            if (mounted) {
              updateUser(null);
              setLoading(false);
            }
            return;
          }
          
          // אם אין סשן אבל יש אירוע אחר, נבדוק שוב
          if (!session && event !== 'SIGNED_OUT') {
            console.warn('⚠️ אין סשן באירוע:', event);
            // ננסה לטעון סשן מחדש
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (newSession?.user) {
              try {
                const currentUser = await getCurrentUser();
                if (mounted) {
                  updateUser(currentUser);
                }
              } catch (err) {
                console.error('שגיאה בטעינת משתמש אחרי אירוע:', err);
                if (mounted) {
                  updateUser(newSession.user);
                }
              }
            } else if (mounted) {
              updateUser(null);
            }
            return;
            return;
          }
          
          // עבור USER_UPDATED - עדכן את המשתמש
          if (event === 'USER_UPDATED' && session?.user) {
            try {
              const currentUser = await getCurrentUser();
              if (mounted) {
                setUser(currentUser);
                setLoading(false);
              }
            } catch (err) {
              console.error('שגיאה בעדכון משתמש:', err);
              if (mounted) {
                setUser(session.user);
                setLoading(false);
              }
            }
            return;
          }
          
          // עבור INITIAL_SESSION - טיפול מיוחד
          // INITIAL_SESSION נקרא אחרי initializeAuth, אז אם יש סשן כבר טיפלנו בו
          // אם אין סשן, המשתמש לא מחובר
          if (event === 'INITIAL_SESSION') {
            if (!session && mounted) {
              // אין סשן - המשתמש לא מחובר
              updateUser(null);
              setLoading(false);
            } else if (session?.user && mounted) {
              // יש סשן - עדכן את המשתמש (למקרה ש-initializeAuth לא הצליח)
              try {
                const currentUser = await getCurrentUser();
                if (mounted) {
                  setUser(currentUser);
                  setLoading(false);
                }
              } catch (err) {
                console.error('שגיאה בטעינת משתמש ב-INITIAL_SESSION:', err);
                if (mounted) {
                  setUser(session.user);
                  setLoading(false);
                }
              }
            }
            return;
          }
          
          // לכל אירוע אחר עם סשן - עדכן את המשתמש
          if (session?.user) {
            try {
              const currentUser = await getCurrentUser();
              if (mounted) {
                setUser(currentUser);
                setLoading(false);
              }
            } catch (err) {
              console.error('שגיאה בטעינת משתמש:', err);
              if (mounted) {
                setUser(session.user);
                setLoading(false);
              }
            }
          }
        }
      );
      subscription = authStateChange?.data?.subscription;
    } catch (err) {
      console.error('שגיאה בהגדרת האזנה לאותנטיקציה:', err);
      if (mounted) {
        setLoading(false);
      }
    }

        return () => {
          mounted = false;
          if (subscription) {
            subscription.unsubscribe();
          }
          if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
          }
          if (visibilityHandler) {
            document.removeEventListener('visibilitychange', visibilityHandler);
          }
        };
      }, []); // ריק - רק פעם אחת בעת mount

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
      updateUser(null);
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

