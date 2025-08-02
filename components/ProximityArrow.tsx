'use client';

import { useState, useEffect } from 'react';
import { Player, PlayerLocation } from '@/types/game';
import { locationService } from '@/lib/locationService';

interface ProximityArrowProps {
  currentPlayer: Player;
  nearestSurvivor: Player;
  className?: string;
}

interface ArrowState {
  bearing: number;
  distance: number;
  isVisible: boolean;
}

const PROXIMITY_THRESHOLD = 100; // Show arrow when within 100 meters
const CLOSE_THRESHOLD = 25; // "Very close" threshold in meters

export default function ProximityArrow({ 
  currentPlayer, 
  nearestSurvivor, 
  className = '' 
}: ProximityArrowProps) {
  const [arrowState, setArrowState] = useState<ArrowState>({
    bearing: 0,
    distance: 0,
    isVisible: false
  });
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);

  // Calculate distance and bearing to nearest survivor
  useEffect(() => {
    if (!currentPlayer.location || !nearestSurvivor.location) {
      setArrowState(prev => ({ ...prev, isVisible: false }));
      return;
    }

    const distance = locationService.calculateDistance(
      currentPlayer.location,
      nearestSurvivor.location
    );

    const bearing = locationService.calculateBearing(
      currentPlayer.location,
      nearestSurvivor.location
    );

    setArrowState({
      bearing,
      distance,
      isVisible: distance <= PROXIMITY_THRESHOLD
    });
  }, [currentPlayer.location, nearestSurvivor.location]);

  // Get device compass heading
  useEffect(() => {
    let mounted = true;
    let orientationListener: ((event: DeviceOrientationEvent) => void) | null = null;

    const setupDeviceOrientation = async () => {
      if (!mounted) return;

      // Check if device orientation is supported
      if (!('DeviceOrientationEvent' in window)) {
        console.log('ProximityArrow: DeviceOrientationEvent not supported');
        return;
      }

      // Request permission for iOS 13+
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== 'granted') {
            console.log('ProximityArrow: Device orientation permission denied');
            return;
          }
        } catch (error) {
          console.log('ProximityArrow: Error requesting orientation permission:', error);
          return;
        }
      }

      // Set up continuous orientation tracking
      orientationListener = (event: DeviceOrientationEvent) => {
        if (!mounted) return;
        
        // Use alpha for compass heading (0-360 degrees)
        let heading = event.alpha;
        
        // On some devices, alpha might be null or webkitCompassHeading might be available
        if (heading === null && (event as any).webkitCompassHeading !== undefined) {
          heading = 360 - (event as any).webkitCompassHeading; // WebKit compass is reversed
        }
        
        if (heading !== null && mounted) {
          setDeviceHeading(heading);
        }
      };

      window.addEventListener('deviceorientation', orientationListener);
    };

    setupDeviceOrientation();

    return () => {
      mounted = false;
      if (orientationListener) {
        window.removeEventListener('deviceorientation', orientationListener);
      }
    };
  }, []);

  if (!arrowState.isVisible) {
    return null;
  }

  // Calculate arrow rotation
  // If we have device heading, adjust bearing relative to device orientation
  // Otherwise, use absolute bearing (north = 0 degrees)
  const arrowRotation = deviceHeading !== null 
    ? arrowState.bearing - deviceHeading 
    : arrowState.bearing;

  // Determine proximity level for styling
  const isVeryClose = arrowState.distance <= CLOSE_THRESHOLD;
  const isClose = arrowState.distance <= 50;

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
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className={`${bgColorClass} rounded-lg p-3 border-2 shadow-lg ${pulseClass}`}>
        {/* Header */}
        <div className="text-center mb-2">
          <div className={`text-xs font-bold ${colorClass}`}>
            🎯 TARGET NEARBY
          </div>
          <div className="text-xs text-gray-600">
            {nearestSurvivor.displayName}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center mb-2">
          <div 
            className={`transform transition-transform duration-500 ${colorClass}`}
            style={{ 
              transform: `rotate(${arrowRotation}deg)`,
              fontSize: '32px',
              lineHeight: 1
            }}
          >
            ↑
          </div>
        </div>

        {/* Distance */}
        <div className="text-center">
          <div className={`text-sm font-bold ${colorClass}`}>
            {formatDistance(arrowState.distance)}
          </div>
          <div className="text-xs text-gray-600">
            {isVeryClose ? 'Very Close!' : isClose ? 'Close' : 'Nearby'}
          </div>
        </div>

        {/* Compass indicator */}
        {deviceHeading === null && (
          <div className="text-xs text-gray-500 text-center mt-1">
            Compass: N/A
          </div>
        )}
      </div>
    </div>
  );
}