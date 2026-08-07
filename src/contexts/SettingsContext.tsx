import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/api';

interface HeroSettings {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_button_text: string;
  hero_button_text_auth: string;
}

interface SettingsContextType {
  siteTitle: string;
  hero: HeroSettings;
  loading: boolean;
  updateSiteTitle: (newTitle: string) => Promise<void>;
  updateAllSettings: (settings: Record<string, string>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultHero: HeroSettings = {
  hero_badge: 'Форум 2025',
  hero_title: 'Добро пожаловать в систему проживания <span style="color: #38bdf8">Алабуга</span>',
  hero_description: 'Интерактивный сервис бронирования жилых помещений, работы с командами и расселения участников форума в реальном времени.',
  hero_button_text: 'Войти / Зарегистрироваться',
  hero_button_text_auth: 'Перейти в личный кабинет',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [siteTitle, setSiteTitle] = useState('Алабуга - форум 2025');
  const [hero, setHero] = useState<HeroSettings>(defaultHero);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      if (data?.site_title) setSiteTitle(data.site_title);
      setHero({
        hero_badge: data?.hero_badge ?? defaultHero.hero_badge,
        hero_title: data?.hero_title ?? defaultHero.hero_title,
        hero_description: data?.hero_description ?? defaultHero.hero_description,
        hero_button_text: data?.hero_button_text ?? defaultHero.hero_button_text,
        hero_button_text_auth: data?.hero_button_text_auth ?? defaultHero.hero_button_text_auth,
      });
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
    await updateSettings({ site_title: newTitle });
    setSiteTitle(newTitle);
  };

  const handleUpdateAllSettings = async (settings: Record<string, string>) => {
    await updateSettings(settings);
    if (settings.site_title) setSiteTitle(settings.site_title);
    if (settings.hero_badge) setHero((prev) => ({ ...prev, hero_badge: settings.hero_badge }));
    if (settings.hero_title) setHero((prev) => ({ ...prev, hero_title: settings.hero_title }));
    if (settings.hero_description) setHero((prev) => ({ ...prev, hero_description: settings.hero_description }));
    if (settings.hero_button_text) setHero((prev) => ({ ...prev, hero_button_text: settings.hero_button_text }));
    if (settings.hero_button_text_auth) setHero((prev) => ({ ...prev, hero_button_text_auth: settings.hero_button_text_auth }));
  };

  return (
    <SettingsContext.Provider
      value={{
        siteTitle,
        hero,
        loading,
        updateSiteTitle: handleUpdateSiteTitle,
        updateAllSettings: handleUpdateAllSettings,
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