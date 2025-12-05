import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  MessageSquareText,
  FileCode,
  Users,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  route: string;
  badge?: number;
}

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get('http://localhost:3000/messages');
        const messages = response.data;
        // Count messages that are received and NOT read
        const count = messages.filter((msg: any) => msg.type !== 'sent' && !msg.read).length;
        setUnreadCount(count);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const navItems: NavItem[] = [
    {
      label: 'Command Center',
      icon: <LayoutDashboard className="w-5 h-5" />,
      route: '/',
    },
    {
      label: 'Live Inbox',
      icon: <MessageSquareText className="w-5 h-5" />,
      route: '/inbox',
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Chat',
      icon: <MessageSquareText className="w-5 h-5" />,
      route: '/chat',
    },
    {
      label: 'Template Forge',
      icon: <FileCode className="w-5 h-5" />,
      route: '/templates',
    },
    {
      label: 'Client 360',
      icon: <Users className="w-5 h-5" />,
      route: '/clients',
    },
    {
      label: 'System Alerts',
      icon: <BellRing className="w-5 h-5" />,
      route: '/alerts',
      badge: 5,
    },
  ];

  return (
    <aside
      className={`glass-panel-strong h-screen sticky top-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'
        } flex flex-col`}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
            <Zap className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1">
              <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                NeuralConnect
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">WhatsApp Suite</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.route}
            to={item.route}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-primary dark:text-primary-light shadow-neon'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-primary' : 'group-hover:text-primary transition-colors'}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-status-error text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Toggle Button */}
      <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
