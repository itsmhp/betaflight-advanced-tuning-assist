import { createContext, useContext, useState } from 'react';
import t from './translations';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('btfl_lang') || 'en'; }
    catch { return 'en'; }
  });

  const changeLang = (code) => {
    setLang(code);
    try { localStorage.setItem('btfl_lang', code); } catch {}
  };

  /** Translate a key. Falls back to English, then the raw key. */
  const translate = (key) => t[lang]?.[key] ?? t['en']?.[key] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang, t: translate }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be inside LangProvider');
  return ctx;
}
