import { useState } from 'react';
import FocusedDashboard from '../components/DailyView/FocusedDashboard';

/**
 * דף הדשבורד הממוקד - המסך הראשי
 */
function FocusPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="pt-4 pb-20">
        <FocusedDashboard />
      </div>
    </div>
  );
}

export default FocusPage;
