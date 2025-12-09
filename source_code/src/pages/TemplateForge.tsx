import React, { useState } from 'react';
import Header from '../components/Header';
import { FaImage, FaVideo, FaFileAlt, FaTimes, FaPlus, FaPhone, FaReply, FaLayerGroup, FaMagic } from 'react-icons/fa';

interface TemplateButton {
    type: 'QUICK_REPLY' | 'CALL_TO_ACTION' | 'PHONE_NUMBER' | 'URL';
    text: string;
    value?: string; // URL or Phone Number
}

const TemplateForge: React.FC = () => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [language, setLanguage] = useState('en_US');
    const [headerType, setHeaderType] = useState('NONE'); // NONE, IMAGE, VIDEO, DOCUMENT
    const [bodyText, setBodyText] = useState('');
    const [footerText, setFooterText] = useState('');
    const [buttons, setButtons] = useState<TemplateButton[]>([]);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name || !bodyText) {
            alert('Please provide a Template Name and Body Text.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name,
                category,
                language,
                header: { type: headerType, content: '' },
                body: bodyText,
                footer: footerText,
                buttons
            };

            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            alert('Template saved successfully!');
            setName('');
            setBodyText('');
            setFooterText('');
            setButtons([]);
        } catch (err: any) {
            console.error(err);
            alert('Failed to save template: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const addVariable = () => {
        const matches = bodyText.match(/{{\d+}}/g);
        const nextIndex = matches ? matches.length + 1 : 1;
        setBodyText(prev => prev + ` {{${nextIndex}}} `);
    };

    const addButton = (type: TemplateButton['type']) => {
        if (buttons.length >= 3) {
            alert('Maximum 3 buttons allowed.');
            return;
        }
        setButtons([...buttons, { type, text: '', value: '' }]);
    };

    const updateButton = (index: number, key: keyof TemplateButton, value: string) => {
        const newButtons = [...buttons];
        // @ts-ignore
        newButtons[index][key] = value;
        setButtons(newButtons);
    };

    const removeButton = (index: number) => {
        setButtons(buttons.filter((_, i) => i !== index));
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1120] font-sans text-gray-900 dark:text-gray-100">
            <Header />

            <main className="flex-1 overflow-y-auto py-8 px-4 md:px-8">
                {/* Centered Container */}
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg text-lg">
                                    <FaLayerGroup />
                                </span>
                                Template Forge
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 ml-14">
                                Design, configure, and launch high-conversion WhatsApp templates.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 ml-14 md:ml-0">
                            <button className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                                View Guide
                            </button>
                        </div>
                    </div>

                    {/* Main Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        {/* LEFT COLUMN: SETTINGS (4/12) */}
                        <div className="lg:col-span-4 space-y-6">

                            {/* Configuration Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700/50 pb-3">
                                    <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs"><FaMagic /></span>
                                    Configuration
                                </h2>

                                <div className="space-y-5">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Internal Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium text-sm"
                                            placeholder="e.g. seasonal_promo_2024"
                                            value={name}
                                            onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Lowercase, underscores only.</p>
                                    </div>

                                    {/* Category & Language */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Category</label>
                                            <select
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                            >
                                                <option value="MARKETING">Marketing</option>
                                                <option value="UTILITY">Utility</option>
                                                <option value="AUTHENTICATION">Auth</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Language</label>
                                            <select
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                value={language}
                                                onChange={e => setLanguage(e.target.value)}
                                            >
                                                <option value="en_US">English (US)</option>
                                                <option value="es_ES">Spanish</option>
                                                <option value="pt_BR">Portuguese</option>
                                            </select>
                                        </div>
                                    </div>

                                    <hr className="border-gray-100 dark:border-gray-700" />

                                    {/* Header Config */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Header Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['NONE', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setHeaderType(type)}
                                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-2 ${headerType === type
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                                                        }`}
                                                >
                                                    {type === 'NONE' && <FaTimes />}
                                                    {type === 'IMAGE' && <FaImage />}
                                                    {type === 'VIDEO' && <FaVideo />}
                                                    {type === 'DOCUMENT' && <FaFileAlt />}
                                                    {type === 'NONE' ? 'None' : type.charAt(0) + type.slice(1).toLowerCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Submit Button (Desktop) */}
                            <div className="sticky top-6">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full py-4 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                                >
                                    {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Template'}
                                </button>
                                <p className="text-center text-[10px] text-gray-400 mt-3">
                                    Ready to deploy instantly.
                                </p>
                            </div>

                        </div>

                        {/* RIGHT COLUMN: EDITOR (8/12) */}
                        <div className="lg:col-span-8 space-y-6">

                            {/* Editor Card - COMPACT VERSION */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                                {/* Toolbar */}
                                <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-700 dark:text-gray-200">Message Canvas</h3>
                                    <div className="flex gap-2">
                                        <button onClick={addVariable} className="text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors text-gray-600 dark:text-gray-300 shadow-sm">
                                            + Variable
                                        </button>
                                        <button className="text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg hover:bg-yellow-50 hover:text-yellow-600 transition-colors text-gray-600 dark:text-gray-300 shadow-sm">
                                            😊 Emoji
                                        </button>
                                    </div>
                                </div>

                                {/* Preview Area */}
                                <div className="flex-1 flex flex-col">

                                    {/* Header Visual */}
                                    {headerType !== 'NONE' && (
                                        <div className="bg-gray-100 dark:bg-gray-900/50 h-40 m-6 mb-0 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 gap-3">
                                            {headerType === 'IMAGE' && <FaImage size={32} />}
                                            {headerType === 'VIDEO' && <FaVideo size={32} />}
                                            {headerType === 'DOCUMENT' && <FaFileAlt size={32} />}
                                            <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{headerType} HEADER</span>
                                        </div>
                                    )}

                                    {/* Main Text Area - REDUCED HEIGHT */}
                                    <textarea
                                        className="w-full flex-1 p-6 text-lg leading-relaxed bg-transparent border-0 focus:ring-0 outline-none resize-none text-gray-800 dark:text-gray-100 placeholder-gray-300"
                                        placeholder="Start typing your message content here..."
                                        value={bodyText}
                                        onChange={e => setBodyText(e.target.value)}
                                        style={{ minHeight: '200px' }}
                                    />

                                    {/* Footer Input */}
                                    <div className="px-6 pb-6">
                                        <input
                                            className="w-full text-sm text-gray-500 bg-transparent border-0 border-b border-dashed border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-gray-400 placeholder-gray-300 pb-2"
                                            placeholder="Add footer text (optional)..."
                                            value={footerText}
                                            onChange={e => setFooterText(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Interactive Actions ({buttons.length}/3)</h4>

                                <div className="space-y-3 mb-4">
                                    {buttons.map((btn, idx) => (
                                        <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-2 pr-3 border border-gray-200 dark:border-gray-700 flex items-center shadow-sm">
                                            <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg text-gray-400 shadow-sm">
                                                {btn.type === 'QUICK_REPLY' ? <FaReply /> : <FaPhone />}
                                            </div>
                                            <div className="flex-1 px-4 grid grid-cols-2 gap-4">
                                                <div className="relative">
                                                    <span className="absolute text-[10px] text-gray-400 -top-2 left-0 font-semibold bg-gray-50 dark:bg-gray-900 px-1">LABEL</span>
                                                    <input
                                                        type="text"
                                                        className="bg-transparent text-sm font-bold text-gray-800 dark:text-white focus:outline-none w-full border-b border-transparent focus:border-blue-500"
                                                        placeholder="Button Label"
                                                        value={btn.text}
                                                        onChange={e => updateButton(idx, 'text', e.target.value)}
                                                    />
                                                </div>
                                                {btn.type !== 'QUICK_REPLY' && (
                                                    <div className="relative">
                                                        <span className="absolute text-[10px] text-gray-400 -top-2 right-0 font-semibold bg-gray-50 dark:bg-gray-900 px-1">VALUE</span>
                                                        <input
                                                            type="text"
                                                            className="bg-transparent text-sm font-medium text-gray-600 dark:text-gray-300 focus:outline-none w-full text-right border-b border-transparent focus:border-blue-500"
                                                            placeholder="https://..."
                                                            value={btn.value}
                                                            onChange={e => updateButton(idx, 'value', e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => removeButton(idx)} className="text-gray-400 hover:text-red-500 p-2 transition-colors">
                                                <FaTimes />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {buttons.length < 3 && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => addButton('QUICK_REPLY')} className="py-3 items-center justify-center flex gap-2 border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-all">
                                            <FaReply /> Add Quick Reply
                                        </button>
                                        <button onClick={() => addButton('CALL_TO_ACTION')} className="py-3 items-center justify-center flex gap-2 border border-gray-200 dark:border-gray-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-green-600 transition-all">
                                            <FaPhone /> Add Call To Action
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TemplateForge;
