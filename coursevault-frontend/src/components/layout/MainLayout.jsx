import React, { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import PageTransition from '../ui/PageTransition.jsx';

const transitionColors = [
  "#E63946", // Red
  "#A7E2D1", // Mint
  "#F9E076", // Yellow
  "#932973", // Purple
  "#87CEFA", // Sky Blue
  "#F26B4D", // Orange
  "#A084E8"  // Lavender
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pick a color based on the path. 
  // PageTransition will "lock" this color when it starts.
  const currentColor = useMemo(() => {
    const pathHash = location.pathname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return transitionColors[pathHash % transitionColors.length];
  }, [location.pathname]);

  const navItems = user?.role === 'educator' 
    ? [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/analytics', label: 'Analytics' },
      ]
    : [
        { path: '/explore', label: 'Explore' },
        { path: '/my-learning', label: 'My Learning' },
      ];

  return (
    <div className="min-h-screen bg-[#FDF1E9] pb-20 font-sans overflow-x-hidden">
      <nav className="relative z-50 flex flex-wrap justify-between items-center px-6 md:px-12 py-8 sticky top-0 bg-[#FDF1E9]">
        {/* Logo */}
        <div 
          className="relative cursor-pointer group inline-block" 
          onClick={() => navigate(user?.role === 'educator' ? '/dashboard' : '/explore')}
        >
          <div className="absolute inset-0 border-2 border-[#1E4ED8] translate-x-1.5 translate-y-1.5 transition-transform group-hover:translate-x-2 group-hover:translate-y-2 z-0"></div>
          <div className="relative z-10 border-2 border-[#1E4ED8] bg-[#FDF1E9] px-2 py-0.5">
            <span className="block font-black text-xl leading-none text-black">Course</span>
            <span className="block font-black text-xl leading-none text-black">Vault.</span>
          </div>
        </div>

        {/* Center Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <div key={item.path} className="relative group cursor-pointer" onClick={() => navigate(item.path)}>
                <div className="absolute inset-0 bg-[#F26B4D] rounded-[40px] border-2 border-black transition-all duration-300 translate-x-0 translate-y-0 group-hover:-translate-x-2 group-hover:translate-y-2"></div>
                <div className="absolute inset-0 bg-[#932973] rounded-[40px] border-2 border-black transition-all duration-300 translate-x-0 translate-y-0 group-hover:-translate-x-1 group-hover:translate-y-1"></div>
                <button className={`relative z-10 px-8 py-3 rounded-[40px] border-2 border-black font-bold text-xl transition-all duration-300 flex items-center gap-2 ${isActive ? 'bg-[#A7E2D1] text-black' : 'bg-white text-black group-hover:bg-[#A7E2D1]'}`}>
                  {item.label}
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 mt-0.5">
                    <path d="M7 10L0.0717964 -1.30318e-06L13.9282 -9.10263e-08L7 10Z" fill="currentColor" stroke="black" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex px-5 py-2 rounded-[30px] border-2 border-black bg-white font-bold text-sm items-center gap-2 cursor-default">
            {user?.name || 'student'}
          </div>
          <button onClick={logout} className="px-5 py-2 rounded-[30px] border-2 border-black bg-white font-bold text-sm hover:bg-[#F26B4D] hover:text-white transition-colors">
            Exit
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 pt-10 relative">
        <AnimatePresence mode="wait">
          <PageTransition 
            key={location.pathname} 
            color={currentColor}
          >
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}