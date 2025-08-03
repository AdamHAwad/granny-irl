'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SkillcheckMinigameProps {
  isOpen: boolean;
  onSuccess: () => void;
  onFailure: () => void;
  onClose: () => void;
  skillcheckId: string;
}

export default function SkillcheckMinigame({
  isOpen,
  onSuccess,
  onFailure,
  onClose,
  skillcheckId
}: SkillcheckMinigameProps) {
  const [angle, setAngle] = useState(0);
  const [successZoneStart, setSuccessZoneStart] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const animationRef = useRef<number>();
  const gameTimerRef = useRef<NodeJS.Timeout>();
  const countdownRef = useRef<NodeJS.Timeout>();

  // Success zone size (in degrees) - smaller = harder
  const SUCCESS_ZONE_SIZE = 30; // degrees
  const NEEDLE_SPEED = 180; // degrees per second
  const TOTAL_GAME_TIME = 30; // seconds

  // Initialize game when opened
  useEffect(() => {
    if (isOpen && !gameStarted) {
      // Reset state
      setAngle(0);
      setTimeRemaining(TOTAL_GAME_TIME);
      
      // Generate random success zone position
      const randomStart = Math.random() * (360 - SUCCESS_ZONE_SIZE);
      setSuccessZoneStart(randomStart);
      
      // Start the game
      setGameStarted(true);
      setIsAnimating(true);
      
      console.log('Skillcheck minigame started for:', skillcheckId);
    }
  }, [isOpen, gameStarted, skillcheckId]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !gameStarted) return;

    countdownRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleFailure();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isOpen, gameStarted]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

    const animate = () => {
      setAngle(prev => {
        const newAngle = (prev + NEEDLE_SPEED / 60) % 360; // 60 FPS
        return newAngle;
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating]);

  const handleSuccess = useCallback(() => {
    console.log('Skillcheck success!');
    setIsAnimating(false);
    setGameStarted(false);
    onSuccess();
  }, [onSuccess]);

  const handleFailure = useCallback(() => {
    console.log('Skillcheck failed!');
    setIsAnimating(false);
    setGameStarted(false);
    onFailure();
  }, [onFailure]);

  const handleSpacePress = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space' && isAnimating) {
      event.preventDefault();
      
      // Check if needle is in success zone
      const successZoneEnd = (successZoneStart + SUCCESS_ZONE_SIZE) % 360;
      let isInZone = false;
      
      if (successZoneStart < successZoneEnd) {
        // Normal case - zone doesn't wrap around
        isInZone = angle >= successZoneStart && angle <= successZoneEnd;
      } else {
        // Zone wraps around 0/360 degrees
        isInZone = angle >= successZoneStart || angle <= successZoneEnd;
      }
      
      if (isInZone) {
        handleSuccess();
      } else {
        handleFailure();
      }
    }
  }, [angle, successZoneStart, isAnimating, handleSuccess, handleFailure]);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (isAnimating) {
      event.preventDefault();
      // Trigger same logic as space press
      handleSpacePress({ code: 'Space', preventDefault: () => {} } as KeyboardEvent);
    }
  }, [isAnimating, handleSpacePress]);

  // Keyboard and touch event listeners
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleSpacePress);
    document.addEventListener('touchstart', handleTouchStart);

    return () => {
      document.removeEventListener('keydown', handleSpacePress);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isOpen, handleSpacePress, handleTouchStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (gameTimerRef.current) {
        clearTimeout(gameTimerRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const needleX = 150 + 100 * Math.cos((angle - 90) * Math.PI / 180);
  const needleY = 150 + 100 * Math.sin((angle - 90) * Math.PI / 180);

  const successZoneEnd = (successZoneStart + SUCCESS_ZONE_SIZE) % 360;
  
  // Create SVG path for success zone arc
  const successZoneStartRad = (successZoneStart - 90) * Math.PI / 180;
  const successZoneEndRad = (successZoneEnd - 90) * Math.PI / 180;
  
  const x1 = 150 + 100 * Math.cos(successZoneStartRad);
  const y1 = 150 + 100 * Math.sin(successZoneStartRad);
  const x2 = 150 + 100 * Math.cos(successZoneEndRad);
  const y2 = 150 + 100 * Math.sin(successZoneEndRad);
  
  const largeArcFlag = SUCCESS_ZONE_SIZE > 180 ? 1 : 0;
  
  const successZonePath = [
    `M 150 150`,
    `L ${x1} ${y1}`,
    `A 100 100 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `Z`
  ].join(' ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-8 text-white text-center max-w-md w-full mx-4">
        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-2">⚡ SKILLCHECK</h2>
          <p className="text-sm text-gray-300 mb-4">Press SPACE when the needle is in the highlighted zone!</p>
          
          {/* Timer */}
          <div className="text-lg font-mono mb-4">
            <span className={`${timeRemaining <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
              {timeRemaining}s remaining
            </span>
          </div>
        </div>

        {/* Skillcheck Circle */}
        <div className="relative mx-auto mb-6" style={{ width: '300px', height: '300px' }}>
          <svg width="300" height="300" className="transform -rotate-90">
            {/* Outer circle */}
            <circle
              cx="150"
              cy="150"
              r="100"
              stroke="#374151"
              strokeWidth="8"
              fill="none"
            />
            
            {/* Inner circle */}
            <circle
              cx="150"
              cy="150"
              r="80"
              stroke="#4B5563"
              strokeWidth="2"
              fill="none"
            />
            
            {/* Success zone */}
            <path
              d={successZonePath}
              fill="#10B981"
              fillOpacity="0.6"
              stroke="#10B981"
              strokeWidth="2"
            />
            
            {/* Needle */}
            <line
              x1="150"
              y1="150"
              x2={needleX}
              y2={needleY}
              stroke="#EF4444"
              strokeWidth="4"
              strokeLinecap="round"
            />
            
            {/* Center dot */}
            <circle
              cx="150"
              cy="150"
              r="8"
              fill="#EF4444"
            />
          </svg>
        </div>

        {/* Instructions */}
        <div className="space-y-2 text-sm text-gray-300">
          <p>🎯 Hit the green zone to complete the skillcheck</p>
          <p>⌨️ Press SPACE or tap the screen when the needle is in the zone</p>
          <p>⚠️ Missing adds 30 seconds to the round timer!</p>
        </div>

        {/* Close button (hidden during active game) */}
        {!gameStarted && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}