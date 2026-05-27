import React from 'react';
import { themes } from '../data/themes';

const Themes = () => {
  return (
    <div>
      <h2>OG Themes</h2>
      <ul>
        {themes.filter((theme) => theme.section === 'OG Themes').map((theme) => (
          <li key={theme.id}>{theme.name}</li>
        ))}
      </ul>

      <h2>Gamer Themes</h2>
      <ul>
        {themes.filter((theme) => theme.section === 'Gamer Themes').map((theme) => (
          <li key={theme.id}>{theme.name}</li>
        ))}
      </ul>

      <h2>Classic Themes</h2>
      <ul>
        {themes.filter((theme) => theme.section === 'Classic Themes').map((theme) => (
          <li key={theme.id}>{theme.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default Themes;
