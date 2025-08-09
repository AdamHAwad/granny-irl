'use client';

import { useState, useEffect } from 'react';
import { Player, PlayerLocation } from '@/types/game';
import { locationService } from '@/lib/locationService';

interface ProximityArrowProps {
  currentPlayer: Player;
  nearestSurvivor: Player;
  className?: string;
}

interface ProximityState {
  distance: number;
  isVisible: boolean;
}

const PROXIMITY_THRESHOLD = 100; // Show card when within 100 meters
const CLOSE_THRESHOLD = 25; // "Very close" threshold in meters

export default function ProximityArrow({ 
  currentPlayer, 
  nearestSurvivor, 
  className = '' 
}: ProximityArrowProps) {
  const [state, setState] = useState<ProximityState>({
    distance: 0,
    isVisible: false,
  });

  // Calculate distance to nearest survivor
  useEffect(() => {
    if (!currentPlayer.location || !nearestSurvivor.location) {
      setState(prev => ({ ...prev, isVisible: false }));
      return;
    }

    const distance = locationService.calculateDistance(
      currentPlayer.location,
      nearestSurvivor.location
    );

    setState({
      distance,
      isVisible: distance <= PROXIMITY_THRESHOLD,
    });
  }, [currentPlayer.location, nearestSurvivor.location]);

  if (!state.isVisible) {
    return null;
  }

  // Determine proximity level for styling
  const isVeryClose = state.distance <= CLOSE_THRESHOLD;
  const isClose = state.distance <= 50;

  // Format distance display
  const formatDistance = (distance: number): string => {
    if (distance < 10) return `${Math.round(distance)}m`;
    if (distance < 100) return `${Math.round(distance / 5) * 5}m`; // Round to nearest 5m
    return `${Math.round(distance / 10) * 10}m`; // Round to nearest 10m
  };

  // Animation classes based on proximity
  const pulseClass = isVeryClose 
    ? 'animate-pulse' 
    : isClose 
    ? 'animate-bounce' 
    : '';

  const colorClass = isVeryClose
    ? 'text-red-600'
    : isClose
    ? 'text-orange-500'
    : 'text-yellow-500';

  const bgColorClass = isVeryClose
    ? 'bg-red-100 border-red-600'
    : isClose
    ? 'bg-orange-100 border-orange-500'
    : 'bg-yellow-100 border-yellow-500';

  return (
    <div className={`fixed bottom-20 right-4 z-30 ${className}`}>
      <div className="relative group">
        <div className={`glass-card border border-prowl-border/20 bg-prowl-bg/95 backdrop-blur-md text-prowl-text rounded-xl p-4 shadow-2xl ${pulseClass}`}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-lg">🎯</span>
            </div>
            <div className="flex-1">
              <div className={`font-semibold mb-0.5 ${colorClass.replace('text-', 'text-')}`}>Target Nearby</div>
              <div className="text-xs text-prowl-text-muted opacity-80">
                {nearestSurvivor.displayName} • {formatDistance(state.distance)} • {isVeryClose ? 'Very close' : isClose ? 'Close' : 'Nearby'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}