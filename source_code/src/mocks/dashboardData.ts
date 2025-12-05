export interface Metric {
  id: string;
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
}

export interface Alert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'FOLLOW_UP' | 'REVIEW_REQUEST' | 'SYSTEM_ERROR' | 'SENTIMENT' | 'TEMPLATE';
  title: string;
  message: string;
  timestamp: string;
  is_read: boolean;
}

export const mockMetrics: Metric[] = [
  {
    id: '1',
    label: 'Open Conversations',
    value: 247,
    change: '+12%',
    trend: 'up',
    icon: 'MessageSquare',
  },
  {
    id: '2',
    label: 'Pending Meta Approvals',
    value: 8,
    change: '-3',
    trend: 'down',
    icon: 'Clock',
  },
  {
    id: '3',
    label: 'API Health',
    value: '99.8%',
    change: 'Stable',
    trend: 'neutral',
    icon: 'Activity',
  },
  {
    id: '4',
    label: 'Daily Active Users',
    value: '12.4K',
    change: '+8.2%',
    trend: 'up',
    icon: 'Users',
  },
];

export const mockAlerts: Alert[] = [
  {
    id: '1',
    severity: 'HIGH',
    type: 'FOLLOW_UP',
    title: 'Follow-up Required',
    message: '3 customers waiting for response over 2 hours',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    is_read: false,
  },
  {
    id: '2',
    severity: 'CRITICAL',
    type: 'SENTIMENT',
    title: 'Negative Sentiment Detected',
    message: 'Customer #9876 expressing frustration in conversation',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    is_read: false,
  },
  {
    id: '3',
    severity: 'MEDIUM',
    type: 'TEMPLATE',
    title: 'Template Rejected',
    message: 'Template "Order Confirmation" was rejected by Meta',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    is_read: true,
  },
  {
    id: '4',
    severity: 'LOW',
    type: 'TEMPLATE',
    title: 'Template Approved',
    message: 'Template "Shipping Update" has been approved',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    is_read: true,
  },
  {
    id: '5',
    severity: 'MEDIUM',
    type: 'REVIEW_REQUEST',
    title: 'Review Requested',
    message: '2 draft templates pending your review',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    is_read: false,
  },
];
