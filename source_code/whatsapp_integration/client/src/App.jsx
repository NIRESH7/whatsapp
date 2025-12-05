import React, { useState } from 'react';
import Dashboard from './Dashboard';
import Login from './Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('auth') === 'true';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('theme') === 'dark';
  });

  React.useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'THEME_CHANGE') {
        console.log('App.jsx: Received THEME_CHANGE', event.data.theme);
        setIsDarkMode(event.data.theme === 'dark');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`App ${isDarkMode ? 'dark' : ''}`}>
      {isAuthenticated ? (
        <Dashboard isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
