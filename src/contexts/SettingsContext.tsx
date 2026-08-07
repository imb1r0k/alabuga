import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/api';

interface SettingsContextType {
  siteTitle: string;
  loading: boolean;
  updateSiteTitle: (newTitle: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [siteTitle, setSiteTitle] = useState('Алабуга - форум 2025');
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      if (data?.site_title) {
        setSiteTitle(data.site_title);
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdateSiteTitle = async (newTitle: string) => {
    await updateSettings(newTitle);
    setSiteTitle(newTitle);
  };

  return (
    <SettingsContext.Provider
      value={{
        siteTitle,
        loading,
        updateSiteTitle: handleUpdateSiteTitle,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};