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

  const needleX = 140 + 90 * Math.cos((angle - 90) * Math.PI / 180);
  const needleY = 140 + 90 * Math.sin((angle - 90) * Math.PI / 180);

  const successZoneEnd = (successZoneStart + successZoneSize) % 360;
  
  // Create SVG path for success zone arc - updated for smaller circle
  const successZoneStartRad = (successZoneStart - 90) * Math.PI / 180;
  const successZoneEndRad = (successZoneEnd - 90) * Math.PI / 180;
  
  const x1 = 140 + 90 * Math.cos(successZoneStartRad);
  const y1 = 140 + 90 * Math.sin(successZoneStartRad);
  const x2 = 140 + 90 * Math.cos(successZoneEndRad);
  const y2 = 140 + 90 * Math.sin(successZoneEndRad);
  
  const largeArcFlag = successZoneSize > 180 ? 1 : 0;
  
  const successZonePath = [
    `M 140 140`,
    `L ${x1} ${y1}`,
    `A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `Z`
  ].join(' ');

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-modal max-w-lg w-full text-granny-text text-center animate-slide-up">
        <div className="p-8">
          <div className="mb-8">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-3xl font-bold mb-3 text-granny-warning">SKILLCHECK</h2>
            <p className="text-granny-text-muted mb-6">Hit the green zone when the needle passes through</p>
            
            {/* Simplified Progress */}
            <div className="mb-6">
              <div className="flex justify-center items-center gap-6 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-granny-success">{hits}</div>
                  <div className="text-sm text-granny-text-muted">Hits</div>
                </div>
                <div className="text-6xl text-granny-text-muted">/</div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-granny-text">{REQUIRED_HITS}</div>
                  <div className="text-sm text-granny-text-muted">Required</div>
                </div>
              </div>
              
              {/* Clean Progress Bar */}
              <div className="w-full bg-granny-surface rounded-full h-2 mb-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-granny-success/60 to-granny-success h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (hits / REQUIRED_HITS) * 100)}%` }}
                />
              </div>
              
              {/* Miss indicator */}
              {misses > 0 && (
                <div className="flex justify-center gap-1 mt-2">
                  {Array.from({ length: MAX_MISSES }, (_, i) => (
                    <div 
                      key={i}
                      className={`w-3 h-3 rounded-full border-2 ${
                        i < misses ? 'bg-granny-error border-granny-error' : 'border-granny-border/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Skillcheck Circle - Simplified */}
          <div className="relative mx-auto mb-8" style={{ width: '280px', height: '280px' }}>
            <div className="absolute inset-0 rounded-full bg-granny-surface/30 border-4 border-granny-border/50"></div>
            
            <svg width="280" height="280" className="transform -rotate-90 relative z-10">
              {/* Main track */}
              <circle
                cx="140"
                cy="140"
                r="90"
                stroke="rgba(42, 42, 45, 0.8)"
                strokeWidth="12"
                fill="none"
              />
              
              {/* Success zone - cleaner design */}
              <path
                d={successZonePath.replace(/150/g, '140').replace(/100/g, '90')}
                fill="rgba(45, 90, 61, 0.7)"
                stroke="#2d5a3d"
                strokeWidth="3"
                className="animate-pulse"
              />
              
              {/* Needle - thinner and more elegant */}
              <line
                x1="140"
                y1="140"
                x2={140 + 90 * Math.cos((angle - 90) * Math.PI / 180)}
                y2={140 + 90 * Math.sin((angle - 90) * Math.PI / 180)}
                stroke="#c41e3a"
                strokeWidth="3"
                strokeLinecap="round"
                className="drop-shadow-lg"
              />
              
              {/* Center dot - smaller and cleaner */}
              <circle
                cx="140"
                cy="140"
                r="6"
                fill="#c41e3a"
                className="drop-shadow-md"
              />
            </svg>
            
            {/* Subtle glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-granny-warning/20 via-transparent to-granny-danger/20 animate-pulse"></div>
          </div>

          {/* Instructions - Simplified */}
          <div className="space-y-3 text-granny-text-muted">
            <div className="glass-card border border-granny-border/20 p-4">
              <p className="font-medium text-granny-text mb-2">
                🎯 Hit the green zone to progress
              </p>
              <p className="text-sm">
                ⌨️ Press SPACE or tap when needle is in green
              </p>
            </div>
            
            {misses > 0 && (
              <div className="glass-card border border-granny-error/30 bg-granny-error/10 p-3">
                <p className="text-sm text-granny-error font-medium">
                  ⚠️ {MAX_MISSES - misses} miss{MAX_MISSES - misses !== 1 ? 'es' : ''} remaining
                </p>
              </div>
            )}
          </div>

          {/* Close button (hidden during active game) */}
          {!gameStarted && (
            <button
              onClick={onClose}
              className="btn-ghost mt-6 px-6 py-3"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}