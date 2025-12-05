import React, { useState, useEffect } from 'react';
import MetricCard from '../components/MetricCard';
import AlertCard from '../components/AlertCard';
import Header from '../components/Header';
import ContextPanel from '../components/ContextPanel';
import { mockMetrics, mockAlerts } from '../mocks/dashboardData';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(mockMetrics);
  const [alerts, setAlerts] = useState(mockAlerts);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const unreadAlerts = alerts.filter((alert) => !alert.is_read);

  return (
    <div className="min-h-screen">
      <Header />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 px-6 pb-6">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Metrics Grid */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Key Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <MetricCard key={index} metric={mockMetrics[0]} loading />
                  ))
                : metrics.map((metric) => (
                    <MetricCard key={metric.id} metric={metric} />
                  ))}
            </div>
          </section>

          {/* Smart Alert System */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Smart Alerts
              </h3>
              {unreadAlerts.length > 0 && (
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-status-error text-white">
                  {unreadAlerts.length} New
                </span>
              )}
            </div>

            <div className="glass-panel p-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="skeleton-shimmer h-24 rounded-lg"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {alerts.length > 0 ? (
                    alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No alerts at the moment</p>
                      <p className="text-sm mt-2">All systems running smoothly</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Context Panel */}
        <div className="hidden xl:block">
          <ContextPanel />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
