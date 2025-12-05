import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Metric } from '../mocks/dashboardData';

interface MetricCardProps {
  metric: Metric;
  loading?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  MessageSquare: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Clock: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Activity: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Users: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
};

const MetricCard: React.FC<MetricCardProps> = ({ metric, loading = false }) => {
  if (loading) {
    return (
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-5 w-32 rounded"></div>
          <div className="skeleton h-10 w-10 rounded-full"></div>
        </div>
        <div className="skeleton h-9 w-24 rounded"></div>
        <div className="skeleton h-4 w-20 rounded"></div>
      </div>
    );
  }

  const getTrendIcon = () => {
    switch (metric.trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-status-success" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-status-error" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (metric.trend) {
      case 'up':
        return 'text-status-success';
      case 'down':
        return 'text-status-error';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="glass-panel p-6 hover:shadow-glass-light dark:hover:shadow-glass transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.label}</h3>
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 text-primary dark:text-primary-light group-hover:from-primary/20 group-hover:to-secondary/20 transition-all">
          {iconMap[metric.icon]}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-semibold text-gray-900 dark:text-white">
          {metric.value}
        </p>
        <div className="flex items-center gap-1.5">
          {getTrendIcon()}
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {metric.change}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
