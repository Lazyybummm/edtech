import React from 'react';

export default function NavButton({ children, isActive, onClick, primary = false }) {
  return (
    <div className="relative group cursor-pointer" onClick={onClick}>
      <div className="absolute inset-0 bg-[#932973] rounded-full brutal-border transition-all duration-300 group-hover:-translate-x-2 group-hover:translate-y-2 z-0"></div>
      <div className="absolute inset-0 bg-[#F26B4D] rounded-full brutal-border transition-all duration-300 group-hover:-translate-x-1 group-hover:translate-y-1 z-0"></div>
      
      <button className={`relative z-10 brutal-border rounded-full px-5 py-2.5 font-bold text-base md:text-lg flex items-center gap-2 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 
        ${isActive ? 'bg-[#A7E2D1]' : primary ? 'bg-[#F9E076]' : 'bg-white group-hover:bg-[#A7E2D1]'}`}>
        {children}
      </button>
    </div>
  );
}