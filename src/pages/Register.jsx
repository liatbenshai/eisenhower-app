import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { validateRegisterForm } from '../utils/validators';
import toast from 'react-hot-toast';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';

/**
 * דף הרשמה
 */
function Register() {
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // ניקוי שגיאה בעת הקלדה
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // שליחת טופס הרשמה
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // אימות
    const validation = validateRegisterForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await register(formData.email, formData.password, formData.fullName);
      setRegistrationComplete(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // הודעת הצלחה
  if (registrationComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
        <motion.div 
          className="card p-8 max-w-md text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✉️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            בדוק את האימייל שלך
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            שלחנו לך קישור לאימות החשבון.
            <br />
            לחץ על הקישור כדי להשלים את ההרשמה.
          </p>
          <Link to="/login" className="btn-primary inline-block">
            חזרה להתחברות
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-8">
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
            צור חשבון חדש
          </p>
        </div>

        {/* כרטיס הרשמה */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="שם מלא"
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              error={errors.fullName}
              placeholder="הזן את שמך המלא"
              autoComplete="name"
            />

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
              placeholder="בחר סיסמה (לפחות 6 תווים)"
              autoComplete="new-password"
            />

            <Input
              label="אימות סיסמה"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="הזן את הסיסמה שוב"
              autoComplete="new-password"
            />

            <Button 
              type="submit" 
              loading={loading}
              fullWidth
            >
              הירשם
            </Button>
          </form>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
            בהרשמה אתה מסכים ל
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">תנאי השימוש</a>
            {' '}ול
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">מדיניות הפרטיות</a>
          </p>
        </div>

        {/* קישור להתחברות */}
        <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
          כבר יש לך חשבון?{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            התחבר
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Register;

