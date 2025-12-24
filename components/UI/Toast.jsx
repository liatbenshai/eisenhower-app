/**
 * רכיב Toast - הודעות קופצות
 * משתמשים בספריית react-hot-toast
 * 
 * שימוש:
 * import toast from 'react-hot-toast';
 * 
 * toast.success('הפעולה בוצעה בהצלחה');
 * toast.error('אירעה שגיאה');
 * toast('הודעה רגילה');
 */

import toast from 'react-hot-toast';

// הגדרות ברירת מחדל
export const toastConfig = {
  duration: 3000,
  position: 'top-center',
  style: {
    direction: 'rtl',
    fontFamily: 'Arial, sans-serif',
    background: '#333',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '8px'
  },
  success: {
    iconTheme: {
      primary: '#10B981',
      secondary: '#fff'
    }
  },
  error: {
    iconTheme: {
      primary: '#EF4444',
      secondary: '#fff'
    }
  }
};

// פונקציות עזר לשימוש מותאם
export const showSuccess = (message) => {
  toast.success(message, toastConfig);
};

export const showError = (message) => {
  toast.error(message, toastConfig);
};

export const showInfo = (message) => {
  toast(message, {
    ...toastConfig,
    icon: 'ℹ️'
  });
};

export const showWarning = (message) => {
  toast(message, {
    ...toastConfig,
    icon: '⚠️',
    style: {
      ...toastConfig.style,
      background: '#F59E0B'
    }
  });
};

// Toast עם אישור
export const showConfirm = (message, onConfirm) => {
  toast((t) => (
    <div className="flex flex-col gap-3" style={{ direction: 'rtl' }}>
      <p>{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => {
            toast.dismiss(t.id);
          }}
          className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
        >
          ביטול
        </button>
        <button
          onClick={() => {
            onConfirm();
            toast.dismiss(t.id);
          }}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          אישור
        </button>
      </div>
    </div>
  ), {
    duration: Infinity,
    position: 'top-center'
  });
};

export default toast;

