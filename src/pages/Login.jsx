import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { validateLoginForm } from '../utils/validators';
import toast from 'react-hot-toast';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';

/**
 * דף התחברות
 */
function Login() {
  const navigate = useNavigate();
  const { login, forgotPassword, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // ניקוי שגיאה בעת הקלדה
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // שליחת טופס התחברות
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // אימות
    const validation = validateLoginForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await login(formData.email, formData.password);
      toast.success('התחברת בהצלחה!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // שליחת קישור לאיפוס סיסמה
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('נא להזין כתובת אימייל');
      return;
    }

    try {
      await forgotPassword(resetEmail);
      toast.success('קישור לאיפוס סיסמה נשלח לאימייל');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
      <motion.div 
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* לוגו */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              מטריצת אייזנהאואר
            </h1>
          </Link>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            התחבר לחשבון שלך
          </p>
        </div>

        {/* כרטיס התחברות */}
        <div className="card p-8">
          {!showForgotPassword ? (
            // טופס התחברות
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="אימייל"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="הזן את האימייל שלך"
                autoComplete="email"
              />

              <Input
                label="סיסמה"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="הזן את הסיסמה שלך"
                autoComplete="current-password"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  שכחתי סיסמה
                </button>
              </div>

              <Button 
                type="submit" 
                loading={loading}
                fullWidth
              >
                התחבר
              </Button>
            </form>
          ) : (
            // טופס שכחתי סיסמה
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  שכחת סיסמה?
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  הזן את האימייל שלך ונשלח לך קישור לאיפוס
                </p>
              </div>

              <Input
                label="אימייל"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="הזן את האימייל שלך"
              />

              <Button 
                type="submit" 
                loading={loading}
                fullWidth
              >
                שלח קישור לאיפוס
              </Button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
              >
                חזרה להתחברות
              </button>
            </form>
          )}
        </div>

        {/* קישור להרשמה */}
        <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
          אין לך חשבון?{' '}
          <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            הירשם עכשיו
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;

