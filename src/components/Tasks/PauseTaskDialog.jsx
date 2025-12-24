import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../UI/Button';

/**
 * סוגי הפרעות
 */
const PAUSE_REASONS = [
  { id: 'client_call', icon: '📞', label: 'שיחת לקוח' },
  { id: 'phone_call', icon: '📱', label: 'שיחה אחרת' },
  { id: 'meeting', icon: '👥', label: 'פגישה' },
  { id: 'urgent_task', icon: '🚨', label: 'משימה דחופה' },
  { id: 'break', icon: '☕', label: 'הפסקה' },
  { id: 'distraction', icon: '🎯', label: 'הסחת דעת' },
  { id: 'other', icon: '❓', label: 'אחר' }
];

/**
 * דיאלוג השהיית משימה
 * מופיע כשהמשתמש רוצה להשהות את המשימה הנוכחית
 * הזמן שנספר כהפרעה לא נספר מזמן המשימה
 */
function PauseTaskDialog({ task, onPause, onCancel, onEndTask }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');
  const [trackInterruption, setTrackInterruption] = useState(true);

  const handlePause = () => {
    onPause({
      reason: selectedReason,
      description,
      trackInterruption,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className="p-6 bg-gradient-to-l from-yellow-500 to-orange-500 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⏸️</span>
            <div>
              <h2 className="text-xl font-bold">השהיית משימה</h2>
              <p className="text-yellow-100 text-sm truncate">
                {task?.title || 'משימה'}
              </p>
            </div>
          </div>
        </div>

        {/* תוכן */}
        <div className="p-6">
          {/* סיבת ההשהיה */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              למה את/ה עוצר/ת?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAUSE_REASONS.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id)}
                  className={`p-3 rounded-xl border-2 transition-all text-right ${
                    selectedReason === reason.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{reason.icon}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {reason.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* תיאור אופציונלי */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              תיאור (אופציונלי)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="שם הלקוח, נושא השיחה..."
              className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* מעקב הפרעות */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={trackInterruption}
                onChange={(e) => setTrackInterruption(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-blue-800 dark:text-blue-200">
                  הפרד את זמן ההפרעה
                </span>
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  הזמן שתשקיע בהפרעה לא ייספר כזמן עבודה על המשימה
                </p>
              </div>
            </label>
          </div>

          {/* כפתורים */}
          <div className="space-y-3">
            <Button
              onClick={handlePause}
              disabled={!selectedReason}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold disabled:opacity-50"
            >
              ⏸️ השהה ועקוב אחרי ההפרעה
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={onEndTask}
                variant="secondary"
                className="flex-1"
              >
                💾 שמור וסיים
              </Button>
              <Button
                onClick={onCancel}
                variant="secondary"
                className="flex-1"
              >
                ↩️ חזור לעבודה
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default PauseTaskDialog;
