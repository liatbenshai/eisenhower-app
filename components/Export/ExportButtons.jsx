import { useState } from 'react';
import ExportModal from './ExportModal';

/**
 * כפתור ייצוא - פותח את מודל הייצוא
 */
function ExportButtons() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
      >
        <span>📥</span>
        <span className="hidden sm:inline">ייצוא</span>
      </button>

      <ExportModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
      />
    </>
  );
}

export default ExportButtons;

