import React, { useState } from 'react';
import { Save } from 'lucide-react';

const SystemSettings = () => {
    const [settings, setSettings] = useState({
        emailNotifications: true,
        bookingAlerts: true,
        language: 'en',
        defaultCurrency: 'EUR',
        autoBackup: true
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Replace with your actual API call
            setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });
        } catch (error) {
            setSaveStatus({ type: 'error', message: 'Error saving settings. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">System Preferences</h1>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    <Save size={20} />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {saveStatus && (
                <div className={`p-4 mb-6 rounded-lg ${
                    saveStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                    {saveStatus.message}
                </div>
            )}

            <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <label className="font-medium">Email Notifications</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.emailNotifications}
                            onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between">
                    <label className="font-medium">Booking Alerts</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.bookingAlerts}
                            onChange={(e) => handleChange('bookingAlerts', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="space-y-2">
                    <label className="font-medium block">Default Language</label>
                    <select
                        value={settings.language}
                        onChange={(e) => handleChange('language', e.target.value)}
                        className="w-full p-2 border rounded-md"
                    >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                    </select>
                </div>

                <div className="flex items-center justify-between">
                    <label className="font-medium">Auto Backup</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.autoBackup}
                            onChange={(e) => handleChange('autoBackup', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;