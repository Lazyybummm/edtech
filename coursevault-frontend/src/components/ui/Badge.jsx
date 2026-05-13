import React from 'react';

export default function Badge({ children, colorClass = "bg-[#87CEFA]" }) {
  return (
    <span className={`inline-block brutal-border ${colorClass} rounded-full px-4 py-1.5 text-sm font-bold text-black`}>
      {children}
    </span>
  );
}