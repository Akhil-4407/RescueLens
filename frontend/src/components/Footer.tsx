import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer
      id="app-operational-footer"
      className="w-full py-3 px-4 border-t border-white/10 bg-black text-center text-[11px] font-mono text-[#9a9a9a] tracking-wider"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>[B-03] ON-DEVICE CV ARCHITECTURE</span>
        <span className="text-white/30 hidden sm:inline">•</span>
        <span>ZERO EXTERNAL CLOUD VISION APIS</span>
        <span className="text-white/30 hidden sm:inline">•</span>
        <span>ZERO OPENAI VISION</span>
      </div>
    </footer>
  );
};
