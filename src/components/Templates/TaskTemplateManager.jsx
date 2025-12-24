import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  getTaskTemplates, 
  createTaskTemplate, 
  updateTaskTemplate, 
  deleteTaskTemplate,
  createTaskFromTemplate 
} from '../../services/supabase';
import { useTasks } from '../../hooks/useTasks';
import { QUADRANT_NAMES, QUADRANT_ICONS } from '../../utils/taskHelpers';
import toast from 'react-hot-toast';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Modal from '../UI/Modal';

/**
 * מנהל תבניות משימות
 */
function TaskTemplateManager({ onSelectTemplate }) {
  const { user } = useAuth();
  const { loadTasks } = useTasks();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quadrant: 1,
    due_time: '',
    reminder_minutes: '',
    estimated_duration: ''
  });

  // טעינת תבניות
  useEffect(() => {
    loadTemplates();
  }, [user?.id]);

  const loadTemplates = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await getTaskTemplates(user.id);
      setTemplates(data || []);
    } catch (err) {
      console.error('שגיאה בטעינת תבניות:', err);
      toast.error('שגיאה בטעינת תבניות');
    } finally {
      setLoading(false);
    }
  };

  // פתיחת טופס יצירה/עריכה
  const openForm = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        title: template.title || '',
        description: template.description || '',
        quadrant: template.quadrant || 1,
        due_time: template.due_time || '',
        reminder_minutes: template.reminder_minutes || '',
        estimated_duration: template.estimated_duration || ''
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        title: '',
        description: '',
        quadrant: 1,
        due_time: '',
        reminder_minutes: '',
        estimated_duration: ''
      });
    }
    setShowForm(true);
  };

  // שמירת תבנית
  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      if (editingTemplate) {
        await updateTaskTemplate(editingTemplate.id, {
          title: formData.title,
          description: formData.description || null,
          quadrant: formData.quadrant,
          due_time: formData.due_time || null,
          reminder_minutes: formData.reminder_minutes ? parseInt(formData.reminder_minutes) : null,
          estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : null
        });
        toast.success('תבנית עודכנה');
      } else {
        await createTaskTemplate({
          user_id: user.id,
          title: formData.title,
          description: formData.description || null,
          quadrant: formData.quadrant,
          due_time: formData.due_time || null,
          reminder_minutes: formData.reminder_minutes ? parseInt(formData.reminder_minutes) : null,
          estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : null,
          is_project: false
        });
        toast.success('תבנית נוצרה');
      }
      setShowForm(false);
      loadTemplates();
    } catch (err) {
      console.error('שגיאה בשמירת תבנית:', err);
      toast.error('שגיאה בשמירת תבנית');
    }
  };

  // מחיקת תבנית
  const handleDelete = async (templateId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את התבנית?')) return;

    try {
      await deleteTaskTemplate(templateId);
      toast.success('תבנית נמחקה');
      loadTemplates();
    } catch (err) {
      console.error('שגיאה במחיקת תבנית:', err);
      toast.error('שגיאה במחיקת תבנית');
    }
  };

  // יצירת משימה מתבנית
  const handleCreateFromTemplate = async (template) => {
    if (!user?.id) return;

    try {
      await createTaskFromTemplate(template.id, user.id);
      toast.success('משימה נוצרה מהתבנית');
      await loadTasks();
      if (onSelectTemplate) {
        onSelectTemplate(null);
      }
    } catch (err) {
      console.error('שגיאה ביצירת משימה מתבנית:', err);
      toast.error('שגיאה ביצירת משימה מתבנית');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p className="mt-2 text-gray-500 dark:text-gray-400">טוען תבניות...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* כותרת וכפתור הוספה */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          תבניות משימות ({templates.length})
        </h3>
        <Button onClick={() => openForm()} size="sm">
          + תבנית חדשה
        </Button>
      </div>

      {/* רשימת תבניות */}
      {templates.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <span className="text-4xl mb-4 block">📋</span>
          <p>אין תבניות</p>
          <Button onClick={() => openForm()} className="mt-4">
            צור תבנית ראשונה
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {template.title}
                  </h4>
                  {template.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg">{QUADRANT_ICONS[template.quadrant]}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                {template.estimated_duration && (
                  <span>⏱️ {template.estimated_duration} דקות</span>
                )}
                {template.due_time && (
                  <span>🕐 {template.due_time}</span>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleCreateFromTemplate(template)}
                  size="sm"
                  className="flex-1"
                >
                  יצירה מהירה
                </Button>
                <Button
                  onClick={() => openForm(template)}
                  size="sm"
                  variant="secondary"
                >
                  ערוך
                </Button>
                <Button
                  onClick={() => handleDelete(template.id)}
                  size="sm"
                  variant="secondary"
                  className="text-red-600 hover:text-red-700"
                >
                  מחק
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* מודל טופס */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingTemplate ? 'עריכת תבנית' : 'תבנית חדשה'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="כותרת"
            name="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            required
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תיאור (אופציונלי)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              רבע במטריצה
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quadrant: q }))}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                    ${formData.quadrant === q
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <span className="text-lg">{QUADRANT_ICONS[q]}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {QUADRANT_NAMES[q]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="שעה (אופציונלי)"
              type="time"
              name="due_time"
              value={formData.due_time}
              onChange={(e) => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
            />
            <Input
              label="זמן משוער (דקות)"
              type="number"
              name="estimated_duration"
              value={formData.estimated_duration}
              onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: e.target.value }))}
              min="1"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" fullWidth>
              {editingTemplate ? 'שמור שינויים' : 'צור תבנית'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              ביטול
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TaskTemplateManager;

