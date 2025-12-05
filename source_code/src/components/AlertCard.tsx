import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import type { Alert } from '../mocks/dashboardData';

interface AlertCardProps {
  alert: Alert;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert }) => {
  const getSeverityColor = () => {
    switch (alert.severity) {
      case 'CRITICAL':
        return 'border-l-status-error bg-red-50/50 dark:bg-red-950/20';
      case 'HIGH':
        return 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20';
      case 'MEDIUM':
        return 'border-l-status-warning bg-yellow-50/50 dark:bg-yellow-950/20';
      case 'LOW':
        return 'border-l-status-success bg-green-50/50 dark:bg-green-950/20';
      default:
        return 'border-l-gray-400 bg-gray-50/50 dark:bg-gray-800/20';
    }
  };

  const getSeverityIcon = () => {
    switch (alert.severity) {
      case 'CRITICAL':
        return <XCircle className="w-5 h-5 text-status-error" />;
      case 'HIGH':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'MEDIUM':
        return <Info className="w-5 h-5 text-status-warning" />;
      case 'LOW':
        return <CheckCircle className="w-5 h-5 text-status-success" />;
      default:
        return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor()} ${
        !alert.is_read ? 'opacity-100' : 'opacity-60'
      } transition-opacity duration-200`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getSeverityIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {alert.title}
            </h4>
            {!alert.is_read && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{alert.message}</p>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimestamp(alert.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AlertCard;
