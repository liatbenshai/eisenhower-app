import { useState } from 'react';
import FocusedDashboard from '../components/DailyView/FocusedDashboard';
import Header from '../components/Layout/Header';
import Sidebar from '../components/Layout/Sidebar';

/**
 * דף הדשבורד הממוקד - המסך הראשי
 */
function FocusPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="pt-4 pb-20">
        <FocusedDashboard />
      </div>
    </div>
  );
}

export default FocusPage;
