import React from 'react';

interface FigmintLogoProps {
  size?: number;
  className?: string;
}

export const FigmintLogo: React.FC<FigmintLogoProps> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <rect x="2" y="2" width="28" height="28" rx="9" fill="#111827" />
    <path d="M9 9.5C9 8.67 9.67 8 10.5 8H21.5C22.33 8 23 8.67 23 9.5V12H14V15H21V19H14V24H10.5C9.67 24 9 23.33 9 22.5V9.5Z" fill="#71E6BE" />
    <circle cx="22.5" cy="22.5" r="2.5" fill="#0D99FF" />
  </svg>
);
