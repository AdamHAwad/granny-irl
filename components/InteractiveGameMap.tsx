'use client';

import { useState, useEffect, useRef } from 'react';
import { Player, PlayerLocation } from '@/types/game';
import { locationService } from '@/lib/locationService';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Next.js
import L from 'leaflet';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

interface InteractiveGameMapProps {
  players: Player[];
  currentPlayerUid: string;
  isKiller: boolean;
  className?: string;
}

// Custom icons for different player types
const createCustomIcon = (player: Player, isCurrentPlayer: boolean = false) => {
  const baseSize = isCurrentPlayer ? 50 : 40;
  let bgColor = '#3B82F6'; // Default blue for survivors
  
  if (player.role === 'killer') {
    bgColor = isCurrentPlayer ? '#DC2626' : '#EF4444';
  } else if (!player.isAlive) {
    bgColor = '#6B7280';
  }

  const html = player.profilePictureUrl
    ? `<div style="
        width: ${baseSize}px;
        height: ${baseSize}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        overflow: hidden;
        background-color: ${bgColor};
      ">
        <img src="${player.profilePictureUrl}" style="
          width: 100%;
          height: 100%;
          object-fit: cover;
        " />
      </div>`
    : `<div style="
        background-color: ${bgColor};
        width: ${baseSize}px;
        height: ${baseSize}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${baseSize * 0.4}px;
      ">${player.displayName[0]?.toUpperCase() || '?'}</div>`;

  return L.divIcon({
    className: 'custom-div-icon',
    html,
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize/2, baseSize/2],
  });
};

export default function InteractiveGameMap({ 
  players, 
  currentPlayerUid, 
  isKiller, 
  className = '' 
}: InteractiveGameMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [center, setCenter] = useState<[number, number]>([37.7749, -122.4194]); // Default to SF
  const [zoom, setZoom] = useState(17); // Higher zoom for better detail
  const [isLoading, setIsLoading] = useState(true);

  // Filter players with valid locations
  const playersWithLocation = players.filter(player => 
    player.location && 
    player.isAlive && 
    player.lastLocationUpdate && 
    Date.now() - player.lastLocationUpdate < 30000 // Within 30 seconds
  );

  const currentPlayer = players.find(p => p.uid === currentPlayerUid);

  // Set initial map center based on current player location
  useEffect(() => {
    if (currentPlayer?.location) {
      setCenter([currentPlayer.location.latitude, currentPlayer.location.longitude]);
      setIsLoading(false);
    } else if (playersWithLocation.length > 0) {
      // Center on first player with location
      const firstPlayer = playersWithLocation[0];
      setCenter([firstPlayer.location!.latitude, firstPlayer.location!.longitude]);
      setIsLoading(false);
    }
  }, [currentPlayer?.location, playersWithLocation]);

  // Auto-fit map to show all players
  useEffect(() => {
    if (!map || playersWithLocation.length === 0) return;

    if (playersWithLocation.length === 1) {
      // Single player - just center on them
      const player = playersWithLocation[0];
      map.setView([player.location!.latitude, player.location!.longitude], 17);
    } else {
      // Multiple players - fit bounds
      const bounds = L.latLngBounds(
        playersWithLocation.map(p => [p.location!.latitude, p.location!.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
  }, [map, playersWithLocation]);

  // Calculate distance for display
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

  // Create player marker with custom icon and popup
  const createPlayerMarker = (player: Player) => {
    if (!player.location) return null;

    const isCurrentPlayer = player.uid === currentPlayerUid;
    const distance = currentPlayer?.location && !isCurrentPlayer
      ? getDistance(currentPlayer.location, player.location)
      : null;

    return (
      <Marker
        key={player.uid}
        position={[player.location.latitude, player.location.longitude]}
        icon={createCustomIcon(player, isCurrentPlayer)}
      >
        <Popup>
          <div className="text-sm">
            <div className="font-bold">{player.displayName}</div>
            <div className="text-xs text-gray-600">
              {player.role === 'killer' ? '🔪 Killer' : '🏃 Survivor'}
              {!player.isAlive && ' (Eliminated)'}
            </div>
            {distance !== null && (
              <div className="text-xs mt-1">
                Distance: {distance < 1000 ? `${Math.round(distance)}m` : `${(distance/1000).toFixed(1)}km`}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Updated: {formatLastUpdate(player.lastLocationUpdate!)}
            </div>
            {player.location.accuracy && (
              <div className="text-xs text-gray-500">
                Accuracy: ±{Math.round(player.location.accuracy)}m
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    );
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

  if (isLoading) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
        <div className="text-gray-600">
          <p className="font-medium">🗺️ Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border-2 border-red-200 ${className}`}>
      <div className="p-3 bg-red-50 border-b border-red-200">
        <h3 className="font-bold text-red-800 text-center">🎯 Killer Tracking Map</h3>
        <div className="text-xs text-red-600 text-center mt-1">
          {playersWithLocation.filter(p => p.role === 'survivor').length} survivor{playersWithLocation.filter(p => p.role === 'survivor').length !== 1 ? 's' : ''} visible
        </div>
      </div>

      <div className="relative">
        <div style={{ height: '400px', width: '100%' }}>
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            ref={setMap}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Render all player markers */}
            {playersWithLocation.map(player => createPlayerMarker(player))}

            {/* Add accuracy circles for players */}
            {playersWithLocation.map(player => {
              if (!player.location?.accuracy || player.location.accuracy > 100) return null;
              
              return (
                <Circle
                  key={`${player.uid}-accuracy`}
                  center={[player.location.latitude, player.location.longitude]}
                  radius={player.location.accuracy}
                  pathOptions={{
                    color: player.role === 'killer' ? '#DC2626' : '#3B82F6',
                    fillOpacity: 0.1,
                    weight: 1,
                  }}
                />
              );
            })}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg p-2 text-xs shadow-lg z-[1000]">
          <div className="font-semibold mb-1">Legend</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white"></div>
            <span>You (Killer)</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
            <span>Survivors</span>
          </div>
          {playersWithLocation.some(p => p.role === 'killer' && p.uid !== currentPlayerUid) && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400 border-2 border-white"></div>
              <span>Other Killers</span>
            </div>
          )}
        </div>

        {/* Controls hint */}
        <div className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-lg p-2 text-xs shadow-lg z-[1000]">
          <div>Pinch to zoom • Drag to pan</div>
        </div>
      </div>

      {/* Update info */}
      <div className="p-2 text-xs text-gray-600 text-center border-t border-red-200">
        Updates every 5 seconds • Tap markers for details
      </div>
    </div>
  );
}