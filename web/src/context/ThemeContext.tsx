import React, { createContext, useContext, useState } from 'react';
import { Theme } from '../interfaces/Theme';

const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [preferredTheme, setPreferredTheme] = useState<Theme | null>(null);

  return (
    <ThemeContext.Provider value={{ preferredTheme, setPreferredTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
