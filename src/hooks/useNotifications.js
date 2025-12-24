import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';

/**
 * Hook לשימוש בקונטקסט ההתראות
 */
export function useNotifications() {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('useNotifications חייב להיות בתוך NotificationProvider');
  }
  
  return context;
}

export default useNotifications;

