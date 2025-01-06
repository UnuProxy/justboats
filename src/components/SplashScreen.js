const SplashScreen = ({ onFinish }) => {
    useEffect(() => {
        const MIN_SPLASH_TIME = 2000; // 2 seconds
        const startTime = Date.now();

        const hideSplashScreen = () => {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, MIN_SPLASH_TIME - elapsedTime);

            setTimeout(() => {
                const splashScreen = document.getElementById('splash-screen');
                if (splashScreen) {
                    // Add Tailwind opacity class for fade out
                    splashScreen.classList.add('opacity-0');
                    
                    setTimeout(() => {
                        onFinish();
                    }, 300);
                }
            }, remainingTime);
        };

        if (document.readyState === 'complete') {
            hideSplashScreen();
        } else {
            window.addEventListener('load', hideSplashScreen);
        }

        return () => {
            window.removeEventListener('load', hideSplashScreen);
        };
    }, [onFinish]);

    return (
        <div 
            id="splash-screen" 
            className="fixed inset-0 flex flex-col items-center justify-center bg-[#0099cc] transition-opacity duration-300 ease-in-out z-50"
        >
            <div className="flex flex-col items-center">
                <img 
                    src="/WhiteLogo-Just-Enjoy.png" 
                    alt="Just Enjoy Ibiza" 
                    className="w-48 h-auto animate-pulse"
                />
                <div className="flex space-x-2 mt-8">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" 
                         style={{ animationDelay: '-0.32s' }}
                    />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" 
                         style={{ animationDelay: '-0.16s' }}
                    />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                </div>
            </div>
        </div>
    );
};