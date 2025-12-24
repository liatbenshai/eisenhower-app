import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { validateLoginForm } from '../../utils/validators';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס התחברות - רכיב נפרד לשימוש חוזר
 */
function LoginForm({ onSuccess, onForgotPassword }) {
  const { login, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // שליחת טופס
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
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrors({ general: err.message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.general && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {errors.general}
        </div>
      )}

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

      {onForgotPassword && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            שכחתי סיסמה
          </button>
        </div>
      )}

      <Button 
        type="submit" 
        loading={loading}
        fullWidth
      >
        התחבר
      </Button>
    </form>
  );
}

export default LoginForm;

