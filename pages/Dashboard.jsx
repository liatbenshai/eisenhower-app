import { useState } from 'react';
import DashboardView from '../components/Dashboard/Dashboard';
import DailyView from '../components/DailyView/DailyView';
import Modal from '../components/UI/Modal';
import SmartWorkIntake from '../components/Scheduler/SmartWorkIntake';
import { useTasks } from '../hooks/useTasks';

/**
 * דף לוח המחוונים הראשי
 */
function Dashboard() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'day', 'week'
  const [showWorkIntake, setShowWorkIntake] = useState(false);
  const { loadTasks } = useTasks();

  // ניווט מהדשבורד
  const handleNavigate = (target) => {
    if (target === 'addWork') {
      setShowWorkIntake(true);
    } else if (target === 'day' || target === 'week') {
      setCurrentView(target);
    }
  };

  // חזרה לדשבורד
  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  return (
    <>
      {currentView === 'dashboard' ? (
        <DashboardView onNavigate={handleNavigate} />
      ) : (
        <div className="relative">
          {/* כפתור חזרה לדשבורד */}
          <button
            onClick={handleBackToDashboard}
            className="fixed top-20 right-4 z-40 bg-white dark:bg-gray-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
          >
            <span>🏠</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">דשבורד</span>
          </button>
          
          <DailyView initialView={currentView} />
        </div>
      )}

      {/* מודל קליטת עבודה */}
      <Modal
        isOpen={showWorkIntake}
        onClose={() => setShowWorkIntake(false)}
        title="📥 עבודה חדשה - שיבוץ חכם"
      >
        <SmartWorkIntake
          onClose={() => setShowWorkIntake(false)}
          onCreated={() => {
            loadTasks();
            setShowWorkIntake(false);
          }}
        />
      </Modal>
    </>
  );
}

export default Dashboard;
