import React from 'react';
import { Sparkles, TrendingUp, AlertCircle } from 'lucide-react';

const ContextPanel: React.FC = () => {
  return (
    <aside className="glass-panel p-6 space-y-6 h-fit sticky top-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Insights
        </h3>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-status-success mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Response Time Improved
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Average response time decreased by 23% this week
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Peak Hours Detected
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  High activity expected between 2-4 PM today
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <button className="w-full px-4 py-2.5 text-sm font-medium text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
            Create New Template
          </button>
          <button className="w-full px-4 py-2.5 text-sm font-medium text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
            Export Analytics
          </button>
          <button className="w-full px-4 py-2.5 text-sm font-medium text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
            Schedule Broadcast
          </button>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          System Status
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">WhatsApp API</span>
            <span className="flex items-center gap-1.5 text-status-success">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
              Online
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Meta Platform</span>
            <span className="flex items-center gap-1.5 text-status-success">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
              Connected
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">AI Engine</span>
            <span className="flex items-center gap-1.5 text-status-success">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
              Active
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ContextPanel;
