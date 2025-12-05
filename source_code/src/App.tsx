import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Chat from './pages/Chat';

import Inbox from './pages/Inbox';

const App: React.FC = () => {
  React.useEffect(() => {
    // Check for login flag in URL first
    const params = new URLSearchParams(window.location.search);
    if (params.get('loggedin') === 'true') {
      localStorage.setItem('isAuthenticated', 'true');
      // Clean URL
      window.history.replaceState({}, '', '/');
      return; // Don't check auth if we just logged in
    }

    // Check authentication only if not processing login
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated && window.location.pathname !== '/login') {
      // Redirect to client login (port 5175)
      window.location.href = 'http://localhost:5175';
    }
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<RedirectToWhatsappLogin />} />
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

const MainLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-surface-lighter dark:bg-surface-darker">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/templates" element={<ComingSoon page="Template Forge" />} />
          <Route path="/clients" element={<ComingSoon page="Client 360" />} />
          <Route path="/alerts" element={<ComingSoon page="System Alerts" />} />
        </Routes>
      </main>
    </div>
  );
};

const RedirectToWhatsappLogin: React.FC = () => {
  React.useEffect(() => {
    // Redirect to client login (port 5175)
    window.location.href = 'http://localhost:5175';
  }, []);
  return null;
};

const ComingSoon: React.FC<{ page: string }> = ({ page }) => {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="glass-panel p-12 text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <span className="text-3xl text-white">🚀</span>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
          {page}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This module is under construction and will be available soon.
        </p>
        <div className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 text-sm text-gray-700 dark:text-gray-300">
          Coming in next release
        </div>
      </div>
    </div>
  );
};

export default App;
