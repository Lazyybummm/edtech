import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, BookOpen, Database, User, LogOut } from 'lucide-react';
import NavButton from '../ui/NavButton';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <nav className="relative z-50 flex flex-wrap justify-between items-center px-6 md:px-10 py-6 gap-6 sticky top-0 bg-[#F4DFD8]/90 backdrop-blur-md border-b-[3px] border-black">
      <div className="flex flex-col leading-none font-bold text-2xl tracking-tighter cursor-pointer" onClick={() => navigate('/explore')}>
        <span>Course</span>
        <span>Vault.</span>
      </div>

      <div className="flex items-center gap-4 hidden md:flex">
        <NavButton isActive={location.pathname === '/explore'} onClick={() => navigate('/explore')}>
          <Compass size={20} strokeWidth={2.5} /> Explore
        </NavButton>
        <NavButton isActive={location.pathname === '/my-learning'} onClick={() => navigate('/my-learning')}>
          <BookOpen size={20} strokeWidth={2.5} /> My Learning
        </NavButton>
        <NavButton isActive={location.pathname === '/library'} onClick={() => navigate('/library')}>
          <Database size={20} strokeWidth={2.5} /> Library
        </NavButton>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="hidden lg:flex items-center gap-2 font-bold bg-white brutal-border rounded-full px-4 py-2 shadow-[2px_2px_0px_0px_#111]">
            <User size={18} /> {user.name}
          </div>
        )}
        <NavButton primary onClick={logout}>
          <LogOut size={18} strokeWidth={2.5} /> <span className="hidden sm:inline">Exit</span>
        </NavButton>
      </div>
    </nav>
  );
}