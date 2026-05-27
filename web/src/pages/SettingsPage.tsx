import React, { useState, useEffect } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import { Theme, ThemeTypes } from '../models/Theme';
import { Box, Button, Dropdown, DropdownItem } from '@shadcn/ui';

const SettingsPage = () => {
  const { theme, themes, setTheme } = React.useContext(ThemeContext);
  const [selectedTheme, setSelectedTheme] = useState(theme);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  const handleThemeChange = (themeName: string) => {
    setTheme(themeName);
    setSelectedTheme(themeName);
  };

  const gamerThemes: ThemeTypes = {
    xbox: {
      name: 'Xbox',
      className: 'xbox',
      variables: {
        backgroundColor: '#2f3436',
        textColor: '#ffffff',
        accentColor: '#23ce6b',
      },
    },
    playstation: {
      name: 'PlayStation',
      className: 'playstation',
      variables: {
        backgroundColor: '#3e8e41',
        textColor: '#ffffff',
        accentColor: '#8bc34a',
      },
    },
    wii: {
      name: 'Wii',
      className: 'wii',
      variables: {
        backgroundColor: '#3498db',
        textColor: '#ffffff',
        accentColor: '#1abc9c',
      },
    },
    nintendoSwitch: {
      name: 'Nintendo Switch',
      className: 'nintendo-switch',
      variables: {
        backgroundColor: '#f7d2c4',
        textColor: '#000000',
        accentColor: '#ffd700',
      },
    },
    segaGenesis: {
      name: 'Sega Genesis',
      className: 'sega-genesis',
      variables: {
        backgroundColor: '#455a64',
        textColor: '#ffffff',
        accentColor: '#8e44ad',
      },
    },
    gameBoy: {
      name: 'Game Boy',
      className: 'game-boy',
      variables: {
        backgroundColor: '#2f3436',
        textColor: '#ffffff',
        accentColor: '#23ce6b',
      },
    },
    nintendo64: {
      name: 'Nintendo 64',
      className: 'nintendo-64',
      variables: {
        backgroundColor: '#3e8e41',
        textColor: '#ffffff',
        accentColor: '#8bc34a',
      },
    },
    dreamcast: {
      name: 'Dreamcast',
      className: 'dreamcast',
      variables: {
        backgroundColor: '#3498db',
        textColor: '#ffffff',
        accentColor: '#1abc9c',
      },
    },
  };

  return (
    <Box>
      <h2>Theme Selection</h2>
      <p>Select a theme:</p>
      <Dropdown>
        {Object.keys(themes).map((themeName) => (
          <DropdownItem key={themeName}>
            <Button
              onClick={() => handleThemeChange(themeName)}
              variant={selectedTheme === themeName ? 'primary' : 'secondary'}
            >
              {themes[themeName as keyof ThemeTypes].name}
            </Button>
          </DropdownItem>
        ))}
      </Dropdown>
      <h2>Gamer Themes</h2>
      <p>Our gaming themes:</p>
      <Dropdown>
        {Object.keys(gamerThemes).map((themeName) => (
          <DropdownItem key={themeName}>
            <Button
              onClick={() => handleThemeChange(themeName)}
              variant={selectedTheme === themeName ? 'primary' : 'secondary'}
            >
              {gamerThemes[themeName as keyof typeof gamerThemes].name}
            </Button>
          </DropdownItem>
        ))}
      </Dropdown>
    </Box>
  );
};

export default SettingsPage;
