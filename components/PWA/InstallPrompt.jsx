import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

/**
 * רכיב להצגת הודעה להתקנת האפליקציה
 */
function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // בדיקה אם האפליקציה כבר מותקנת
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // בדיקה אם זה iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // בדיקה אם כבר דחינו את ההודעה
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      // נציג שוב אחרי 7 ימים
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (new Date() - dismissedDate) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Android Chrome - beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS - נציג הוראות ידניות
    if (isIOSDevice) {
      // נציג אחרי 3 שניות
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android Chrome
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('✅ האפליקציה תותקן בקרוב!');
        setShowPrompt(false);
      }
      
      setDeferredPrompt(null);
    } else if (isIOS) {
      // iOS - נציג הוראות
      toast.info('📱 לחצי על כפתור השיתוף ולאחר מכן "הוסף למסך הבית"', {
        duration: 8000
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl">📱</span>
            <div>
              <p className="font-bold text-sm">התקיני את האפליקציה למסך הבית</p>
              <p className="text-xs opacity-90">
                {isIOS 
                  ? 'גישה מהירה ונוחה יותר' 
                  : 'גישה מהירה ללא דפדפן'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleInstall}
              variant="secondary"
              size="sm"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              {isIOS ? 'הוראות' : 'התקן'}
            </Button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-gray-200 text-xl"
              aria-label="סגור"
            >
              ×
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default InstallPrompt;

