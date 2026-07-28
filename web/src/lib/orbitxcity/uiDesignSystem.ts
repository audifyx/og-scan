/** 
 * AAA-quality UI design system with glassmorphism, animations, and premium styling.
 * Provides design tokens and component patterns for consistent, polished UI.
 */

export interface UITheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    background: string;
    surface: string;
    surfaceLight: string;
    text: string;
    textMuted: string;
    border: string;
  };
  glass: {
    light: string;
    medium: string;
    dark: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    heading: string;
    body: string;
    caption: string;
  };
  animation: {
    fast: string;
    normal: string;
    slow: string;
  };
}

/**
 * Premium cyberpunk-inspired theme for OrbitX.
 */
export const PREMIUM_THEME: UITheme = {
  colors: {
    primary: '#c5a26f', // Gold
    secondary: '#00d9ff', // Cyan
    accent: '#ff00ff', // Magenta
    success: '#00ff00',
    warning: '#ffaa00',
    danger: '#ff0055',
    background: '#0a0a14',
    surface: 'rgba(20, 20, 35, 0.8)',
    surfaceLight: 'rgba(40, 40, 60, 0.6)',
    text: '#ffffff',
    textMuted: '#a0a0b0',
    border: 'rgba(197, 162, 111, 0.2)',
  },
  glass: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.1)',
    dark: 'rgba(0, 0, 0, 0.2)',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '2rem',
    xl: '3rem',
  },
  typography: {
    heading: 'font-family: "Inter", sans-serif; font-weight: 700; letter-spacing: -0.02em;',
    body: 'font-family: "Inter", sans-serif; font-weight: 400; letter-spacing: 0;',
    caption: 'font-family: "Courier New", monospace; font-weight: 500; font-size: 0.75rem;',
  },
  animation: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

/**
 * Generate glassmorphism backdrop styles.
 */
export function getGlassStyle(
  intensity: 'light' | 'medium' | 'dark' = 'medium',
  blur: number = 10
): React.CSSProperties {
  const bgColor = PREMIUM_THEME.glass[intensity];

  return {
    background: bgColor,
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    border: `1px solid ${PREMIUM_THEME.colors.border}`,
    borderRadius: '0.75rem',
  };
}

/**
 * Premium button styles with hover/active states.
 */
export function getButtonStyle(
  variant: 'primary' | 'secondary' | 'ghost' = 'primary'
): React.CSSProperties {
  const variants = {
    primary: {
      background: PREMIUM_THEME.colors.primary,
      color: '#000000',
      border: 'none',
      fontWeight: 600,
      boxShadow: `0 0 20px rgba(197, 162, 111, 0.4)`,
    },
    secondary: {
      background: 'transparent',
      color: PREMIUM_THEME.colors.secondary,
      border: `2px solid ${PREMIUM_THEME.colors.secondary}`,
      fontWeight: 600,
      boxShadow: `0 0 10px rgba(0, 217, 255, 0.3)`,
    },
    ghost: {
      background: 'transparent',
      color: PREMIUM_THEME.colors.text,
      border: `1px solid ${PREMIUM_THEME.colors.border}`,
      fontWeight: 500,
    },
  };

  return {
    padding: `${PREMIUM_THEME.spacing.sm} ${PREMIUM_THEME.spacing.lg}`,
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: `all ${PREMIUM_THEME.animation.fast}`,
    ...variants[variant],
  };
}

/**
 * Premium panel/card styling.
 */
export function getPanelStyle(elevated: boolean = false): React.CSSProperties {
  return {
    ...getGlassStyle('medium', 8),
    padding: PREMIUM_THEME.spacing.lg,
    boxShadow: elevated
      ? `0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(197, 162, 111, 0.1)`
      : `0 4px 16px rgba(0, 0, 0, 0.3)`,
  };
}

/**
 * Text gradient effect (cyberpunk style).
 */
export function getGradientTextStyle(colors: string[]): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${colors.join(', ')})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundSize: '200% 200%',
  };
}

/**
 * Neon glow effect (cyan/magenta accent).
 */
export function getNeonGlowStyle(color: string, intensity: number = 1): React.CSSProperties {
  const blur = 10 * intensity;
  const spread = 5 * intensity;

  return {
    textShadow: `0 0 ${blur}px ${color}, 0 0 ${spread}px ${color}`,
    color: color,
  };
}

/**
 * Shimmer/loading animation.
 */
export const SHIMMER_ANIMATION = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
  
  .shimmer {
    animation: shimmer 2s infinite;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0),
      rgba(255, 255, 255, 0.2),
      rgba(255, 255, 255, 0)
    );
    background-size: 1000px 100%;
  }
`;

/**
 * Pulse animation (breathing effect).
 */
export const PULSE_ANIMATION = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;

/**
 * Glow animation (neon effect).
 */
export const GLOW_ANIMATION = `
  @keyframes glow {
    0%, 100% {
      filter: drop-shadow(0 0 8px rgba(0, 217, 255, 0.5));
    }
    50% {
      filter: drop-shadow(0 0 16px rgba(0, 217, 255, 0.8));
    }
  }
  
  .glow {
    animation: glow 2s ease-in-out infinite;
  }
`;

/**
 * Slide-in animation for panels.
 */
export const SLIDE_IN_ANIMATION = `
  @keyframes slideIn {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .slide-in {
    animation: slideIn 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

/**
 * Fade-in animation.
 */
export const FADE_IN_ANIMATION = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .fade-in {
    animation: fadeIn 300ms ease-out;
  }
`;

/**
 * Scale-in animation (pop effect).
 */
export const SCALE_IN_ANIMATION = `
  @keyframes scaleIn {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  .scale-in {
    animation: scaleIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
`;

/**
 * Inject all animations into document.
 */
export function injectAnimations() {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    ${SHIMMER_ANIMATION}
    ${PULSE_ANIMATION}
    ${GLOW_ANIMATION}
    ${SLIDE_IN_ANIMATION}
    ${FADE_IN_ANIMATION}
    ${SCALE_IN_ANIMATION}
  `;

  document.head.appendChild(style);
}
