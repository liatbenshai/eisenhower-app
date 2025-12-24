import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { validateRegisterForm } from '../../utils/validators';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס הרשמה - רכיב נפרד לשימוש חוזר
 */
function RegisterForm({ onSuccess }) {
  const { register, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    const validation = validateRegisterForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await register(formData.email, formData.password, formData.fullName);
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
  );
}

export default RegisterForm;

