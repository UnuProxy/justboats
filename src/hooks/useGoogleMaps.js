// src/hooks/useGoogleMaps.js
import { useState, useEffect } from 'react';

const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsLoaded(true);
    } else {
      const timer = setInterval(() => {
        if (window.google && window.google.maps) {
          setIsLoaded(true);
          clearInterval(timer);
        }
      }, 100);

      return () => clearInterval(timer);
    }
  }, []);

  return { isLoaded };
};

export default useGoogleMaps;