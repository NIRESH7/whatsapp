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
      className={`bg-surface-dark h-screen sticky top-0 transition-all duration-300 ease-in-out border-r border-gray-800 ${collapsed ? 'w-20' : 'w-64'
        } flex flex-col shadow-xl z-50`}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white tracking-tight">
                NeuralConnect
              </h1>
              <p className="text-xs text-gray-500">WhatsApp Suite</p>
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
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                ? 'bg-primary text-white shadow-soft'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-white' : 'group-hover:text-white transition-colors'}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-600 text-white">
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
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors text-gray-400"
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
