import React, { useState, useEffect, useRef } from 'react';

export default function ScreenProtection({ children }) {
  const [isBlackedOut, setIsBlackedOut] = useState(false);
  const pressedKeys = useRef(new Set());
  const timerRef = useRef(null);
  const DELAY = 3000; // 3 seconds blackout

  useEffect(() => {
    let active = false; // Local tracking to prevent closure staleness

    const showBlackout = (reason) => {
      if (active) return;
      
      active = true;
      setIsBlackedOut(true);
      console.log(`⚫ BLACKOUT TRIGGERED — Reason: ${reason}`);

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        if (active) {
          setIsBlackedOut(false);
          active = false;
          console.log(`🟢 UNLOCKED after ${DELAY / 1000}s`);
        }
        timerRef.current = null;
      }, DELAY);
    };

    const handleKeyDown = (e) => {
      const key = e.key;
      if (pressedKeys.current.has(key)) return;

      pressedKeys.current.add(key);

      const isModifier = ['Meta',  'Control', 'Alt'].includes(key);
//Shift+Cmd has to be added
      // PrintScreen key protection
      if (e.code === 'PrintScreen' || key === 'PrintScreen') {
        e.preventDefault();
        if (!active) showBlackout('PrintScreen key');
        return;
      }

      // Single modifier protection (catches Cmd+Shift+4 on Mac, Ctrl+PrintScreen on Windows)
      if (isModifier && !active) {
        e.preventDefault();
        showBlackout(`Modifier key: ${key}`);
        return;
      }

      // Combo protection (any three keys)
      if (!active && pressedKeys.current.size >= 3) {
        e.preventDefault();
        showBlackout('Key Combo');
        return;
      }
    };

    const handleKeyUp = (e) => {
      pressedKeys.current.delete(e.key);
    };

    // Protects against external snipping tools clicking out of the browser
    const handleBlur = () => {
      if (!active) showBlackout('Window lost focus');
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !active) showBlackout('Tab hidden');
    };

    // Block Right-Click
    const handleContextMenu = (e) => {
      e.preventDefault();
      if (!active) showBlackout('Right-click');
    };

    const handleFocus = () => {
      pressedKeys.current.clear();
    };

    // Attach all event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('focus', handleFocus);

    // Cleanup listeners when component unmounts
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('focus', handleFocus);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      {children}
      
      {/* The Blackout Overlay */}
      {isBlackedOut && (
        <div className="fixed inset-0 bg-black z-[999999] flex flex-col items-center justify-center text-white font-mono gap-4 pointer-events-auto">
          <div className="text-6xl">🔐</div>
          <div className="text-3xl font-bold tracking-widest uppercase">Screen Locked</div>
          <div className="text-xl text-gray-400">Content Protection Active · Please Wait</div>
        </div>
      )}
    </>
  );
}