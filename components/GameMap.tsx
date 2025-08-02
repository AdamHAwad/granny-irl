'use client';

import { useState, useEffect, useRef } from 'react';
import { Player, PlayerLocation } from '@/types/game';
import { locationService } from '@/lib/locationService';

interface GameMapProps {
  players: Player[];
  currentPlayerUid: string;
  isKiller: boolean;
  className?: string;
}

interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export default function GameMap({ players, currentPlayerUid, isKiller, className = '' }: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [currentLocation, setCurrentLocation] = useState<PlayerLocation | null>(null);

  // Filter players with locations (more frequent updates = shorter timeout)
  const playersWithLocation = players.filter(player => 
    player.location && 
    player.isAlive && 
    player.lastLocationUpdate && 
    Date.now() - player.lastLocationUpdate < 30000 // Within 30 seconds (faster updates)
  );

  const currentPlayer = players.find(p => p.uid === currentPlayerUid);

  // Calculate map bounds to fit all players
  useEffect(() => {
    if (playersWithLocation.length === 0) {
      setMapBounds(null);
      return;
    }

    const locations = playersWithLocation
      .map(p => p.location!)
      .filter(Boolean);

    if (locations.length === 0) {
      setMapBounds(null);
      return;
    }

    let minLat = locations[0].latitude;
    let maxLat = locations[0].latitude;
    let minLng = locations[0].longitude;
    let maxLng = locations[0].longitude;

    locations.forEach(loc => {
      minLat = Math.min(minLat, loc.latitude);
      maxLat = Math.max(maxLat, loc.latitude);
      minLng = Math.min(minLng, loc.longitude);
      maxLng = Math.max(maxLng, loc.longitude);
    });

    // Add padding around the bounds (roughly 50 meters)
    const latPadding = 0.0005; // ~50m in degrees
    const lngPadding = 0.0005;

    setMapBounds({
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
    });
  }, [playersWithLocation]);

  // Convert lat/lng to pixel coordinates
  const latLngToPixel = (lat: number, lng: number, mapWidth: number, mapHeight: number) => {
    if (!mapBounds) return { x: 0, y: 0 };

    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * mapWidth;
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * mapHeight;

    return { x, y };
  };

  // Get current location for killers
  useEffect(() => {
    if (isKiller && currentPlayer?.location) {
      setCurrentLocation(currentPlayer.location);
    }
  }, [isKiller, currentPlayer?.location]);

  // Calculate distance between two points
  const getDistance = (loc1: PlayerLocation, loc2: PlayerLocation): number => {
    return locationService.calculateDistance(loc1, loc2);
  };

  // Format last update time
  const formatLastUpdate = (timestamp: number): string => {
    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m ago`;
  };

  if (!isKiller) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
        <div className="text-gray-600">
          <p className="font-medium">🗺️ Map View</p>
          <p className="text-sm mt-2">Map is only available to killers during active games</p>
        </div>
      </div>
    );
  }

  if (playersWithLocation.length === 0) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
        <div className="text-gray-600">
          <p className="font-medium">📍 Waiting for survivor locations...</p>
          <p className="text-sm mt-2">Survivors need to enable location sharing to appear on the map</p>
        </div>
      </div>
    );
  }

  if (!mapBounds) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
        <div className="text-gray-600">
          <p className="font-medium">🗺️ Loading map...</p>
        </div>
      </div>
    );
  }

  const mapWidth = 300;
  const mapHeight = 200;

  // Get survivors for killers to track
  const survivors = playersWithLocation.filter(p => p.role === 'survivor');
  const otherKillers = playersWithLocation.filter(p => p.role === 'killer' && p.uid !== currentPlayerUid);

  return (
    <div className={`bg-white rounded-lg border-2 border-red-200 ${className}`}>
      <div className="p-3 bg-red-50 border-b border-red-200">
        <h3 className="font-bold text-red-800 text-center">🎯 Killer Map</h3>
        <div className="text-xs text-red-600 text-center mt-1">
          {survivors.length} survivor{survivors.length !== 1 ? 's' : ''} visible
        </div>
      </div>

      <div className="p-3">
        {/* Map Container */}
        <div 
          ref={mapRef}
          className="relative bg-green-50 border-2 border-green-200 rounded mx-auto"
          style={{ width: mapWidth, height: mapHeight }}
        >
          {/* Grid lines for reference */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d1fae5" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Render survivors */}
          {survivors.map(player => {
            const { x, y } = latLngToPixel(
              player.location!.latitude,
              player.location!.longitude,
              mapWidth,
              mapHeight
            );

            const distance = currentLocation 
              ? getDistance(currentLocation, player.location!)
              : null;

            return (
              <div key={player.uid} className="absolute transform -translate-x-1/2 -translate-y-1/2">
                <div
                  style={{ left: x, top: y }}
                  className="absolute"
                >
                  {/* Player avatar */}
                  <div className="relative">
                    {player.profilePictureUrl ? (
                      <div className="w-8 h-8 rounded-full border-2 border-blue-500 bg-white overflow-hidden flex items-center justify-center">
                        <img
                          src={player.profilePictureUrl}
                          alt={player.displayName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.log('Failed to load profile picture for', player.displayName, ':', player.profilePictureUrl);
                            // Hide the entire container and show fallback
                            const container = e.currentTarget.parentElement;
                            if (container) container.style.display = 'none';
                            const fallback = container?.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                          onLoad={() => {
                            console.log('Successfully loaded profile picture for', player.displayName);
                          }}
                        />
                      </div>
                    ) : null}
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-blue-500 bg-blue-100 flex items-center justify-center"
                      style={{ display: player.profilePictureUrl ? 'none' : 'flex' }}
                    >
                      <span className="text-xs font-bold text-blue-700">
                        {player.displayName[0]?.toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Distance indicator */}
                    {distance !== null && (
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap">
                        {distance < 1000 ? `${Math.round(distance)}m` : `${(distance/1000).toFixed(1)}km`}
                      </div>
                    )}
                  </div>

                  {/* Player info tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-75 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none">
                    <div className="font-medium">{player.displayName}</div>
                    <div>Last seen: {formatLastUpdate(player.lastLocationUpdate!)}</div>
                    {player.location!.accuracy && (
                      <div>Accuracy: ±{Math.round(player.location!.accuracy)}m</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Render other killers */}
          {otherKillers.map(player => {
            const { x, y } = latLngToPixel(
              player.location!.latitude,
              player.location!.longitude,
              mapWidth,
              mapHeight
            );

            return (
              <div key={player.uid} className="absolute transform -translate-x-1/2 -translate-y-1/2">
                <div
                  style={{ left: x, top: y }}
                  className="absolute"
                >
                  {player.profilePictureUrl ? (
                    <div className="w-6 h-6 rounded-full border-2 border-red-400 bg-white opacity-75 overflow-hidden flex items-center justify-center">
                      <img
                        src={player.profilePictureUrl}
                        alt={player.displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.log('Failed to load profile picture for other killer', player.displayName, ':', player.profilePictureUrl);
                          const container = e.currentTarget.parentElement;
                          if (container) container.style.display = 'none';
                          const fallback = container?.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    </div>
                  ) : null}
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-red-400 bg-red-100 flex items-center justify-center opacity-75"
                    style={{ display: player.profilePictureUrl ? 'none' : 'flex' }}
                  >
                    <span className="text-xs font-bold text-red-700">
                      {player.displayName[0]?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Render current player (killer) */}
          {currentLocation && (
            <div className="absolute transform -translate-x-1/2 -translate-y-1/2">
              <div
                style={{
                  left: latLngToPixel(currentLocation.latitude, currentLocation.longitude, mapWidth, mapHeight).x,
                  top: latLngToPixel(currentLocation.latitude, currentLocation.longitude, mapWidth, mapHeight).y
                }}
                className="absolute"
              >
                {currentPlayer?.profilePictureUrl ? (
                  <div className="w-10 h-10 rounded-full border-4 border-red-600 bg-white shadow-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={currentPlayer.profilePictureUrl}
                      alt="You"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.log('Failed to load profile picture for current player', currentPlayer.displayName, ':', currentPlayer.profilePictureUrl);
                        const container = e.currentTarget.parentElement;
                        if (container) container.style.display = 'none';
                        const fallback = container?.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  </div>
                ) : null}
                <div 
                  className="w-10 h-10 rounded-full border-4 border-red-600 bg-red-200 flex items-center justify-center shadow-lg"
                  style={{ display: currentPlayer?.profilePictureUrl ? 'none' : 'flex' }}
                >
                  <span className="text-sm font-bold text-red-800">YOU</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-red-600 bg-red-200"></div>
            <span>You (Killer)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-100"></div>
            <span>Survivors</span>
          </div>
          {otherKillers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-red-400 bg-red-100 opacity-75"></div>
              <span>Other Killers</span>
            </div>
          )}
        </div>

        {/* Update info */}
        <div className="mt-2 text-xs text-gray-600 text-center">
          Updates every 5 seconds • Hover for details
        </div>
      </div>
    </div>
  );
}