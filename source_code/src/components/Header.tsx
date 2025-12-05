import React from 'react';
import { Sun, Moon, Monitor, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Header: React.FC = () => {
  const { theme, setTheme, actualTheme } = useTheme();

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <header className="glass-panel sticky top-0 z-10 px-6 py-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Neural Command Center
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time WhatsApp Business Intelligence
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Switcher */}
          <div className="flex items-center gap-2 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
            {themeOptions.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`p-2 rounded-md transition-all duration-200 ${theme === value
                  ? 'bg-white dark:bg-gray-700 shadow-md text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                aria-label={`Switch to ${label} theme`}
                title={label}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('isAuthenticated');
              window.location.href = 'http://localhost:5175';
            }}
            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
