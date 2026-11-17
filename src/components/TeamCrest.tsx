import React from 'react';

interface TeamCrestProps {
  name: string;
  shortName: string;
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  name,
  shortName,
  color,
  size = 'md',
}) => {
  const sizeMap = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-11 h-11 text-xs',
    lg: 'w-14 h-14 text-sm',
  };

  const label = (shortName || name).slice(0, 4);

  return (
    <div
      title={name}
      className={`${sizeMap[size]} relative shrink-0 rounded-xl flex items-center justify-center font-black tracking-tight shadow-md border border-white/15 overflow-hidden select-none`}
      style={{
        background: `linear-gradient(145deg, ${color}dd, ${color}55 60%, #070B10 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/35 pointer-events-none" />
      <span className="relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] leading-none px-0.5 text-center">
        {label}
      </span>
    </div>
  );
};
