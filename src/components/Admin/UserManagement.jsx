import { useState } from 'react';
import UserTable from './UserTable';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * ניהול משתמשים
 */
function UserManagement({ users, onToggleUser, onDeleteUser, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive

  // סינון משתמשים
  const filteredUsers = users.filter(user => {
    // חיפוש
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // סטטוס
    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.is_active) ||
      (filterStatus === 'inactive' && !user.is_active);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* כלי חיפוש וסינון */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* חיפוש */}
          <div className="flex-1">
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש לפי שם או אימייל..."
                className="input-field pr-10"
              />
            </div>
          </div>

          {/* סינון סטטוס */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'הכל' },
              { value: 'active', label: 'פעילים' },
              { value: 'inactive', label: 'מושהים' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterStatus === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* רענון */}
          <Button variant="secondary" onClick={onRefresh}>
            🔄 רענן
          </Button>
        </div>
      </div>

      {/* מספר תוצאות */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          מציג {filteredUsers.length} מתוך {users.length} משתמשים
        </p>
      </div>

      {/* טבלת משתמשים */}
      {filteredUsers.length > 0 ? (
        <UserTable
          users={filteredUsers}
          onToggleUser={onToggleUser}
          onDeleteUser={onDeleteUser}
        />
      ) : (
        <div className="card p-8 text-center">
          <span className="text-4xl mb-4 block">🔍</span>
          <p className="text-gray-500 dark:text-gray-400">
            לא נמצאו משתמשים התואמים את החיפוש
          </p>
        </div>
      )}
    </div>
  );
}

export default UserManagement;

