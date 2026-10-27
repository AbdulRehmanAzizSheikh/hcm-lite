import { createContext, useContext, useState, useEffect } from 'react';
import { T, LANGS } from '../i18n/translations';

const Ctx = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    return localStorage.getItem('lang') || 'en';
  });
  useEffect(() => { localStorage.setItem('lang', lang); const info = LANGS.find(l => l.code === lang) || LANGS[0]; if (typeof document !== 'undefined') { document.documentElement.dir = info.dir; document.documentElement.lang = lang; } }, [lang]);
  const setLang = (c) => setLangState(c);
  const t = (key) => (T[lang] && T[lang][key]) || (T.en[key] || key);
  const langInfo = LANGS.find(l => l.code === lang) || LANGS[0];
  return <Ctx.Provider value={{ lang, setLang, t, langInfo, LANGS }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
