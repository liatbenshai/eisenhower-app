import { useState } from 'react';

/**
 * קומפוננטת לשוניות
 */
function Tabs({ tabs, defaultTab = 0 }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  return (
    <div className="w-full">
      {/* כותרות הלשוניות */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`
              px-4 py-3 text-sm font-medium whitespace-nowrap
              transition-colors duration-200
              border-b-2
              ${activeTab === index
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* תוכן הלשונית הפעילה */}
      <div className="mt-4">
        {tabs[activeTab]?.content}
      </div>
    </div>
  );
}

export default Tabs;

