// Icônes SVG identiques à la maquette (style Material rempli) — copie exacte, pas d'équivalent approximatif
import React from "react";

const S = ({ size = 18, className = "", children, testId }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} data-testid={testId} aria-hidden="true">
    {children}
  </svg>
);

// Goutte pleine (conso thermique)
export const MatWaterDrop = ({ size, className }) => (
  <S size={size} className={className}>
    <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
  </S>
);

// Prise électrique à broches (conso électrique)
export const MatPower = ({ size, className }) => (
  <S size={size} className={className}>
    <path d="M16.01 7L16 3h-2v4h-4V3H8v4h-.01C6.9 7 6 7.89 6 8.98v5.52L9.5 18v3h5v-3l3.5-3.51V8.98C18 7.89 17.11 7 16.01 7z" />
  </S>
);

// Batterie verticale pleine (SOC moyen EV)
export const MatBatteryFull = ({ size, className }) => (
  <S size={size} className={className}>
    <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
  </S>
);

// Batterie verticale avec éclair (EV batterie faible)
export const MatBatteryCharging = ({ size, className }) => (
  <S size={size} className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zM11 20v-5.5H9L13 7v5.5h2L11 20z" />
  </S>
);

// Wi-Fi plein (couverture télémétrie)
export const MatWifi = ({ size, className }) => (
  <S size={size} className={className}>
    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
  </S>
);
