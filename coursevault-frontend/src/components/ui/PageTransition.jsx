import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function PageTransition({ children, color = "#E63946" }) {
  // LOCK the color: This ensures that even if the 'color' prop changes 
  // during the exit animation, this specific instance keeps its original color.
  const [lockedColor] = useState(color);

  const customEase = [0.76, 0, 0.24, 1]; 
  const animationDuration = 1.4; // Slightly slower as requested

  return (
    <>
      {/* Content Fade */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        {children}
      </motion.div>

      {/* Slide IN: Covers the screen from Left to Right */}
      <motion.div
        className="fixed inset-0 z-[9999] pointer-events-none"
        style={{ 
          transformOrigin: "left", // Start from left
          backgroundColor: lockedColor 
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 0 }}
        exit={{ scaleX: 1 }}
        transition={{ duration: animationDuration, ease: customEase }}
      />

      {/* Slide OUT: Uncovers the screen by moving to the Right */}
      <motion.div
        className="fixed inset-0 z-[9999] pointer-events-none"
        style={{ 
          transformOrigin: "right", // Reveal towards the right
          backgroundColor: lockedColor 
        }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        exit={{ scaleX: 0 }}
        transition={{ 
          duration: animationDuration, 
          ease: customEase,
          delay: 0.1 
        }}
      />
    </>
  );
}