import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const Chat: React.FC = () => {
    const { actualTheme } = useTheme();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Create stable URL with initial theme to avoid iframe reload on theme change
    const initialSrc = React.useMemo(() => {
        return `http://localhost:5174?auth=true&theme=${actualTheme}`;
    }, []); // Empty dependency array ensures it never changes after mount

    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            console.log('Chat.tsx: Sending THEME_CHANGE', actualTheme);
            iframeRef.current.contentWindow.postMessage({ type: 'THEME_CHANGE', theme: actualTheme }, '*');
        }
    }, [actualTheme]);

    return (
        <div className="h-full w-full flex flex-col bg-surface-lighter dark:bg-surface-darker">
            <div className="flex-1 relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm m-4">
                <iframe
                    ref={iframeRef}
                    src={initialSrc}
                    className="absolute inset-0 w-full h-full border-0"
                    title="WhatsApp Chat"
                    allow="camera; microphone; clipboard-read; clipboard-write"
                    onLoad={() => {
                        // Send initial theme when loaded
                        if (iframeRef.current && iframeRef.current.contentWindow) {
                            iframeRef.current.contentWindow.postMessage({ type: 'THEME_CHANGE', theme: actualTheme }, '*');
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default Chat;
