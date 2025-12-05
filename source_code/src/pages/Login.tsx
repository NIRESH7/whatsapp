import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Lock, Mail } from 'lucide-react';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate login delay
        setTimeout(() => {
            setIsLoading(false);
            navigate('/');
        }, 1000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-lighter dark:bg-surface-darker p-4 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[100px]" />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="glass-panel p-8 md:p-10 shadow-2xl border-t border-white/20">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center p-3 rounded-xl bg-gradient-to-br from-primary to-secondary mb-4 shadow-lg shadow-primary/20">
                            <Zap className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-2">
                            Welcome Back
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Sign in to access your NeuralConnect dashboard
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Password
                                </label>
                                <a href="#" className="text-xs font-medium text-primary hover:text-primary-dark transition-colors">
                                    Forgot password?
                                </a>
                            </div>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Sign In <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Don't have an account?{' '}
                            <a href="#" className="font-semibold text-primary hover:text-primary-dark transition-colors">
                                Create account
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
