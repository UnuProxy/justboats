// src/components/SplashScreen.js
import React, { useEffect } from 'react';

const SplashScreen = ({ onFinish }) => {
  useEffect(() => {
    const MIN_SPLASH_TIME = 2000; // 2 seconds
    const startTime = Date.now();

    const hide = () => {
      const elapsed = Date.now() - startTime;
      const delay   = Math.max(0, MIN_SPLASH_TIME - elapsed);

      setTimeout(() => {
        // fade out
        const el = document.getElementById('splash-screen');
        if (el) el.classList.add('opacity-0');

        // then finish
        setTimeout(onFinish, 300);
      }, delay);
    };

    if (document.readyState === 'complete') {
      hide();
    } else {
      window.addEventListener('load', hide);
    }
    return () => window.removeEventListener('load', hide);
  }, [onFinish]);

  return (
    <div
      id="splash-screen"
      className="fixed inset-0 flex items-center justify-center bg-[#0099cc] transition-opacity duration-300 ease-in-out z-50"
    >
      <div className="text-center">
        <img
          src="/WhiteLogo-Just-Enjoy.png"
          alt="Just Enjoy Ibiza"
          className="w-48 h-auto animate-pulse mx-auto"
        />
        <div className="flex space-x-2 justify-center mt-6">
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '-0.32s' }} />
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '-0.16s' }} />
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
