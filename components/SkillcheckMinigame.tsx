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
  const [successZoneSize, setSuccessZoneSize] = useState(30);
  const [needleSpeed, setNeedleSpeed] = useState(180);
  const [isAnimating, setIsAnimating] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const animationRef = useRef<number>();

  // Game parameters
  const MIN_SUCCESS_ZONE_SIZE = 20; // degrees
  const MAX_SUCCESS_ZONE_SIZE = 40; // degrees
  const MIN_NEEDLE_SPEED = 120; // degrees per second
  const MAX_NEEDLE_SPEED = 300; // degrees per second
  const REQUIRED_HITS = 15; // hits needed to complete
  const MAX_MISSES = 3; // fail after 3 misses

  // Randomize success zone position and size
  const randomizeSuccessZone = useCallback(() => {
    const newSize = MIN_SUCCESS_ZONE_SIZE + Math.random() * (MAX_SUCCESS_ZONE_SIZE - MIN_SUCCESS_ZONE_SIZE);
    const newStart = Math.random() * (360 - newSize);
    setSuccessZoneSize(newSize);
    setSuccessZoneStart(newStart);
  }, []);

  // Randomize needle speed
  const randomizeNeedleSpeed = useCallback(() => {
    const newSpeed = MIN_NEEDLE_SPEED + Math.random() * (MAX_NEEDLE_SPEED - MIN_NEEDLE_SPEED);
    setNeedleSpeed(newSpeed);
  }, []);

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

  // Initialize game when opened
  useEffect(() => {
    if (isOpen && !gameStarted) {
      // Reset state
      setAngle(0);
      setHits(0);
      setMisses(0);
      
      // Generate initial random success zone and speed
      randomizeSuccessZone();
      randomizeNeedleSpeed();
      
      // Start the game
      setGameStarted(true);
      setIsAnimating(true);
      
      console.log('Skillcheck minigame started for:', skillcheckId);
    }
  }, [isOpen, gameStarted, skillcheckId, randomizeSuccessZone, randomizeNeedleSpeed]);

  // Check for game completion
  useEffect(() => {
    if (!gameStarted) return;

    // Check if player has reached required hits
    if (hits >= REQUIRED_HITS) {
      handleSuccess();
    }
  }, [hits, gameStarted, handleSuccess]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

    const animate = () => {
      setAngle(prev => {
        const newAngle = (prev + needleSpeed / 60) % 360; // 60 FPS
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
  }, [isAnimating, needleSpeed]);

  const handleSpacePress = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space' && isAnimating) {
      event.preventDefault();
      
      // Check if needle is in success zone
      const successZoneEnd = (successZoneStart + successZoneSize) % 360;
      let isInZone = false;
      
      if (successZoneStart < successZoneEnd) {
        // Normal case - zone doesn't wrap around
        isInZone = angle >= successZoneStart && angle <= successZoneEnd;
      } else {
        // Zone wraps around 0/360 degrees
        isInZone = angle >= successZoneStart || angle <= successZoneEnd;
      }
      
      if (isInZone) {
        // Hit! Increment counter and randomize zone and speed
        setHits(prev => prev + 1);
        randomizeSuccessZone();
        randomizeNeedleSpeed();
        console.log('Hit! Total hits:', hits + 1, 'New speed:', needleSpeed);
      } else {
        // Miss! Increment miss counter
        setMisses(prev => {
          const newMisses = prev + 1;
          if (newMisses >= MAX_MISSES) {
            handleFailure();
          }
          return newMisses;
        });
        console.log('Miss! Total misses:', misses + 1);
      }
    }
  }, [angle, successZoneStart, successZoneSize, isAnimating, hits, misses, needleSpeed, randomizeSuccessZone, randomizeNeedleSpeed, handleFailure]);

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
    };
  }, []);

  if (!isOpen) return null;

  const needleX = 150 + 100 * Math.cos((angle - 90) * Math.PI / 180);
  const needleY = 150 + 100 * Math.sin((angle - 90) * Math.PI / 180);

  const successZoneEnd = (successZoneStart + successZoneSize) % 360;
  
  // Create SVG path for success zone arc
  const successZoneStartRad = (successZoneStart - 90) * Math.PI / 180;
  const successZoneEndRad = (successZoneEnd - 90) * Math.PI / 180;
  
  const x1 = 150 + 100 * Math.cos(successZoneStartRad);
  const y1 = 150 + 100 * Math.sin(successZoneStartRad);
  const x2 = 150 + 100 * Math.cos(successZoneEndRad);
  const y2 = 150 + 100 * Math.sin(successZoneEndRad);
  
  const largeArcFlag = successZoneSize > 180 ? 1 : 0;
  
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
          <p className="text-sm text-gray-300 mb-4">Hit the moving zones with varying speeds!</p>
          
          {/* Stats */}
          <div className="flex justify-center gap-8 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{hits}/{REQUIRED_HITS}</div>
              <div className="text-xs text-gray-400">Hits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{Math.round(needleSpeed)}°/s</div>
              <div className="text-xs text-gray-400">Speed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{misses}/{MAX_MISSES}</div>
              <div className="text-xs text-gray-400">Misses</div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (hits / REQUIRED_HITS) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">Get {REQUIRED_HITS} hits to complete</p>
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
          <p>🎯 Green zones change position, size, and needle speed varies</p>
          <p>⌨️ Press SPACE or tap when the red needle is in the green zone</p>
          <p>⚠️ {MAX_MISSES} misses = fail! Get {REQUIRED_HITS} hits to complete!</p>
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