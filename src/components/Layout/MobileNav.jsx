import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUADRANT_ICONS, QUADRANT_NAMES } from '../../utils/taskHelpers';

/**
 * ניווט נייד - כפתור צף להוספת משימה
 */
function MobileNav({ onAddTask }) {
  const [showQuadrantPicker, setShowQuadrantPicker] = useState(false);

  // בחירת רבע
  const handleQuadrantSelect = (quadrant) => {
    setShowQuadrantPicker(false);
    onAddTask(quadrant);
  };

  return (
    <>
      {/* כפתור צף להוספת משימה */}
      <div className="fixed bottom-6 left-6 md:hidden z-30">
        <motion.button
          onClick={() => setShowQuadrantPicker(!showQuadrantPicker)}
          whileTap={{ scale: 0.9 }}
          className={`
            w-14 h-14 rounded-full shadow-lg
            flex items-center justify-center
            text-white text-2xl
            transition-all duration-300
            ${showQuadrantPicker ? 'bg-gray-600 rotate-45' : 'bg-blue-600'}
          `}
        >
          +
        </motion.button>

        {/* בחירת רבע */}
        <AnimatePresence>
          {showQuadrantPicker && (
            <>
              {/* רקע */}
              <div 
                className="fixed inset-0 bg-black/20 z-10"
                onClick={() => setShowQuadrantPicker(false)}
              />
              
              {/* תפריט רבעים */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-16 left-0 z-20"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <p className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    הוסף משימה ל:
                  </p>
                  {[1, 2, 3, 4].map((quadrant, index) => (
                    <motion.button
                      key={quadrant}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleQuadrantSelect(quadrant)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-xl">{QUADRANT_ICONS[quadrant]}</span>
                      <span className="text-gray-900 dark:text-white">{QUADRANT_NAMES[quadrant]}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default MobileNav;

