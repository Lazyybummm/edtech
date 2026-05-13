import React from 'react';

export default function Button({ children, onClick, type = 'button', variant = 'primary', className = '' }) {
  const baseStyles = "brutal-border rounded-xl px-6 py-4 font-bold text-xl flex items-center justify-center gap-2 transition-all shadow-[4px_4px_0px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#111] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]";
  const variants = {
    primary: "bg-[#F9E076] hover:bg-[#A7E2D1]",
    secondary: "bg-[#A7E2D1]",
    accent: "bg-[#F26B4D]",
  };

  return (
    <button type={type} onClick={onClick} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}