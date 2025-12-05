import React, { useState } from 'react';
import './Login.css';
import { FaGithub, FaGoogle, FaCommentDots } from 'react-icons/fa';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch('http://localhost:3000/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                window.location.href = 'http://localhost:5173?loggedin=true';
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            console.error('Login error:', err);
        }
    };

    const [view, setView] = useState('login'); // 'login', 'forgot', 'reset'
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('resetToken');
        if (token) {
            setResetToken(token);
            setView('reset');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleForgotSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        try {
            const response = await fetch('http://localhost:3000/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            if (response.ok) {
                setMessage(data.message);
            } else {
                setError(data.error || 'Failed to send reset link');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetToken, newPassword }),
            });
            const data = await response.json();
            if (response.ok) {
                setMessage('Password reset successful! You can now login.');
                setTimeout(() => setView('login'), 2000);
            } else {
                setError(data.error || 'Failed to reset password');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-container">
                        <FaCommentDots className="logo-icon" />
                    </div>
                    <h2>{view === 'login' ? 'Welcome to ChatFlow' : view === 'forgot' ? 'Reset Password' : 'New Password'}</h2>
                    <p>{view === 'login' ? 'Sign in to your account to continue' : view === 'forgot' ? 'Enter your email to receive a reset link' : 'Enter your new password'}</p>
                </div>

                {error && <div className="error-message" style={{ color: 'red', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}
                {message && <div className="success-message" style={{ color: 'green', marginBottom: '10px', textAlign: 'center' }}>{message}</div>}

                {view === 'login' && (
                    <>
                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group">
                                <label htmlFor="email">Email or Username</label>
                                <input
                                    type="text"
                                    id="email"
                                    placeholder="Enter your email or username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    id="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div className="form-actions">
                                <label className="remember-me">
                                    <input type="checkbox" />
                                    <span>Remember me</span>
                                </label>
                                <a href="#" onClick={(e) => { e.preventDefault(); setView('forgot'); }} className="forgot-password">Forgot password?</a>
                            </div>

                            <button type="submit" className="login-btn">Log In</button>
                        </form>

                        <div className="divider">
                            <span>OR</span>
                        </div>

                        <div className="social-login">
                            <button className="social-btn" onClick={() => window.location.href = 'http://localhost:3000/auth/github'}>
                                <FaGithub /> GitHub
                            </button>
                            <button className="social-btn" onClick={() => window.location.href = 'http://localhost:3000/auth/google'}>
                                <FaGoogle /> Google
                            </button>
                        </div>

                        <div className="login-footer">
                            Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setView('signup'); }}>Sign up here</a>
                        </div>
                    </>
                )}

                {view === 'forgot' && (
                    <form onSubmit={handleForgotSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Enter your registered email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="login-btn">Send Reset Link</button>
                        <div className="login-footer">
                            <a href="#" onClick={(e) => { e.preventDefault(); setView('login'); }}>Back to Login</a>
                        </div>
                    </form>
                )}

                {view === 'reset' && (
                    <form onSubmit={handleResetSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="newPassword">New Password</label>
                            <input
                                type="password"
                                id="newPassword"
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="login-btn">Reset Password</button>
                    </form>
                )}
                {view === 'signup' && (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        setError('');
                        try {
                            const response = await fetch('http://localhost:3000/auth/register', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email, password, name: email.split('@')[0] }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                                window.location.href = 'http://localhost:5173?loggedin=true';
                            } else {
                                setError(data.error || 'Registration failed');
                            }
                        } catch (err) {
                            setError('Network error');
                        }
                    }} className="login-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="login-btn">Sign Up</button>
                        <div className="login-footer">
                            Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setView('login'); }}>Log In</a>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
