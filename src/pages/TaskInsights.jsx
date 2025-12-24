import { useState } from 'react';
import TaskTypeInsights from '../components/Tasks/TaskTypeInsights';
import Header from '../components/Layout/Header';
import Sidebar from '../components/Layout/Sidebar';

/**
 * עמוד תובנות על משימות
 */
function TaskInsights() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📊 תובנות למידה אישיות
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            האפליקציה לומדת את דפוסי העבודה שלך ומספקת תובנות לשיפור ניהול הזמן
          </p>
        </div>

        <TaskTypeInsights />
      </div>
    </div>
  );
}

export default TaskInsights;

