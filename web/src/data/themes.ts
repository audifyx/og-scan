import { Theme } from '../interfaces/Theme';

const ogThemes: Theme[] = [
  { id: 1, name: 'OG Theme 1', section: 'OG Themes', description: 'OG Theme 1 description' },
  { id: 2, name: 'OG Theme 2', section: 'OG Themes', description: 'OG Theme 2 description' },
  // Add more OG themes here...
];

const gamerThemes: Theme[] = [
  { id: 11, name: 'Gamer Theme 1', section: 'Gamer Themes', description: 'Gamer Theme 1 description' },
  { id: 12, name: 'Gamer Theme 2', section: 'Gamer Themes', description: 'Gamer Theme 2 description' },
  // Add more gamer themes here...
];

const classicThemes: Theme[] = [
  { id: 21, name: 'Classic Theme 1', section: 'Classic Themes', description: 'Classic Theme 1 description' },
  { id: 22, name: 'Classic Theme 2', section: 'Classic Themes', description: 'Classic Theme 2 description' },
  // Add more classic themes here...
];

export const themes = [...ogThemes, ...gamerThemes, ...classicThemes];
