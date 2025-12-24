import { useState } from 'react';
import { formatDateHe } from '../../utils/dateHelpers';
import Button from '../UI/Button';

/**
 * טבלת משתמשים
 */
function UserTable({ users, onToggleUser, onDeleteUser }) {
  const [expandedUser, setExpandedUser] = useState(null);

  return (
    <div className="card overflow-hidden">
      {/* טבלה - דסקטופ */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                משתמש
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                תפקיד
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                סטטוס
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                הצטרף
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                התחברות אחרונה
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                פעולות
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map(user => (
              <tr 
                key={user.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {user.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.full_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.role === 'super_admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {user.role === 'super_admin' ? 'מנהל על' : 'משתמש'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {user.is_active ? 'פעיל' : 'מושהה'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDateHe(user.created_at, { short: true })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {user.last_login 
                    ? formatDateHe(user.last_login, { short: true })
                    : 'אף פעם'
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant={user.is_active ? 'secondary' : 'success'}
                      size="sm"
                      onClick={() => onToggleUser(user.id, !user.is_active)}
                    >
                      {user.is_active ? 'השהה' : 'הפעל'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDeleteUser(user.id)}
                    >
                      מחק
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* כרטיסים - נייד */}
      <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
        {users.map(user => (
          <div 
            key={user.id}
            className="p-4"
          >
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.full_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                user.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {user.is_active ? 'פעיל' : 'מושהה'}
              </span>
            </div>

            {/* פרטים מורחבים */}
            {expandedUser === user.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">תפקיד:</span>
                  <span className="text-gray-900 dark:text-white">
                    {user.role === 'super_admin' ? 'מנהל על' : 'משתמש'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">הצטרף:</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatDateHe(user.created_at, { short: true })}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant={user.is_active ? 'secondary' : 'success'}
                    size="sm"
                    fullWidth
                    onClick={() => onToggleUser(user.id, !user.is_active)}
                  >
                    {user.is_active ? 'השהה' : 'הפעל'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    onClick={() => onDeleteUser(user.id)}
                  >
                    מחק
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserTable;

