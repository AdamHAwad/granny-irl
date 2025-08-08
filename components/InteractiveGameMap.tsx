/**
 * Interactive Game Map - Leaflet-based real-world map for Granny IRL
 * 
 * Features:
 * - OpenStreetMap integration (free, no API keys)
 * - Interactive controls (pinch-zoom, drag-pan)
 * - Custom player markers with profile pictures
 * - Real-time position updates
 * - Auto-fit bounds to show all players
 * - Distance calculations and accuracy circles
 * - Mobile-optimized touch controls
 * 
 * Visibility Rules:
 * - Killers: Can see all players (killers + survivors)
 * - Survivors: Can see themselves + other survivors (killers hidden)
 * - Eliminated players: Can see all players (spectator mode)
 * 
 * Technical notes:
 * - Uses dynamic imports to avoid SSR issues
 * - Custom div icons for profile picture markers
 * - Responsive design for mobile gameplay
 */

'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Player, PlayerLocation, Skillcheck, EscapeArea } from '@/types/game';
import { locationService } from '@/lib/locationService';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Leaflet setup for Next.js SSR compatibility
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
  isEliminated?: boolean;
  selectedPlayerId?: string | null;
  onPlayerClick?: (playerId: string) => void;
  onMapClick?: () => void;
  className?: string;
  skillchecks?: Skillcheck[]; // Optional skillchecks to display
  escapeArea?: EscapeArea; // Optional escape area to display (survivors only)
  onEnableLocation?: () => void; // Callback to enable location
}

// Custom icon for skillchecks
const createSkillcheckIcon = (skillcheck: Skillcheck) => {
  const baseSize = 35;
  const isCompleted = skillcheck.isCompleted;
  const bgColor = isCompleted ? '#10B981' : '#F59E0B'; // Green if completed, amber if pending
  const iconSymbol = isCompleted ? '✓' : '⚡';
  
  const html = `<div style="
    width: ${baseSize}px;
    height: ${baseSize}px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    background-color: ${bgColor};
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: ${baseSize * 0.5}px;
    ${isCompleted ? 'opacity: 0.7;' : ''}
  ">${iconSymbol}</div>`;

  return L.divIcon({
    className: 'custom-skillcheck-icon',
    html,
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize/2, baseSize/2],
  });
};

// Custom icon for escape area (purple circle)
const createEscapeAreaIcon = () => {
  const baseSize = 45;
  
  const html = `<div style="
    width: ${baseSize}px;
    height: ${baseSize}px;
    border-radius: 50%;
    border: 4px solid white;
    box-shadow: 0 3px 8px rgba(0,0,0,0.4);
    background-color: #8B5CF6;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: ${baseSize * 0.4}px;
    animation: escapeAreaPulse 2s infinite;
  ">🚪</div>
  <style>
    @keyframes escapeAreaPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 3px 8px rgba(0,0,0,0.4); }
      50% { transform: scale(1.1); box-shadow: 0 4px 12px rgba(139,92,246,0.6); }
    }
  </style>`;

  return L.divIcon({
    className: 'custom-escape-area-icon',
    html,
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize/2, baseSize/2],
  });
};

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

function InteractiveGameMap({ 
  players, 
  currentPlayerUid, 
  isKiller,
  isEliminated = false,
  selectedPlayerId,
  onPlayerClick,
  onMapClick,
  className = '',
  skillchecks = [],
  escapeArea,
  onEnableLocation
}: InteractiveGameMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [center, setCenter] = useState<[number, number]>([37.7749, -122.4194]); // Default to SF
  const [zoom, setZoom] = useState(17); // Higher zoom for better detail
  const [isLoading, setIsLoading] = useState(true);

  // Memoized filter for skillchecks based on role visibility
  const visibleSkillchecks = useMemo(() => {
    // Killers cannot see skillchecks (per game rules)
    if (isKiller && !isEliminated) {
      return [];
    }
    
    // Survivors and eliminated players can see skillchecks
    return skillchecks;
  }, [skillchecks, isKiller, isEliminated]);

  // Memoized escape area visibility - only survivors and eliminated players can see it
  const visibleEscapeArea = useMemo(() => {
    // Killers cannot see escape area (per game rules)
    if (isKiller && !isEliminated) {
      console.log('🗺️ DEBUG: Hiding escape area from killer');
      return null;
    }
    
    // Only show if escape area exists and is revealed
    const result = escapeArea?.isRevealed ? escapeArea : null;
    console.log('🗺️ DEBUG: Escape area visibility check:', {
      escapeAreaExists: !!escapeArea,
      isRevealed: escapeArea?.isRevealed,
      isKiller,
      isEliminated,
      willShow: !!result
    });
    return result;
  }, [escapeArea, isKiller, isEliminated]);

  // Memoized filter for players with location (expensive operation)
  const playersWithLocation = useMemo(() => {
    const now = Date.now();
    const allPlayersWithLocation = players.filter(player => 
      player.location && 
      player.isAlive && 
      player.lastLocationUpdate && 
      (now - player.lastLocationUpdate) < 30000 // Within 30 seconds
    );

    // Eliminated players (spectators) can see everyone
    if (isEliminated) {
      return allPlayersWithLocation;
    }

    // Killers can see all players (killers + survivors)
    if (isKiller) {
      return allPlayersWithLocation;
    }

    // Survivors can only see themselves and other survivors (not killers)
    return allPlayersWithLocation.filter(player => 
      player.role === 'survivor' || player.uid === currentPlayerUid
    );
  }, [players, isEliminated, isKiller, currentPlayerUid]);

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

  // Optimized map bounds calculation with debouncing
  useEffect(() => {
    if (!map || playersWithLocation.length === 0) return;

    const updateMapView = () => {
      // If a player is selected, center on them
      if (selectedPlayerId) {
        const selectedPlayer = playersWithLocation.find(p => p.uid === selectedPlayerId);
        if (selectedPlayer?.location) {
          map.setView([selectedPlayer.location.latitude, selectedPlayer.location.longitude], 18, { animate: true });
          return;
        }
      }

      if (playersWithLocation.length === 1) {
        // Single player - just center on them
        const player = playersWithLocation[0];
        map.setView([player.location!.latitude, player.location!.longitude], 17, { animate: true });
      } else {
        // Multiple players - optimized bounds fitting
        const bounds = L.latLngBounds(
          playersWithLocation.map(p => [p.location!.latitude, p.location!.longitude])
        );
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18, animate: true });
      }
    };

    // Debounce map updates for better performance
    const timeoutId = setTimeout(updateMapView, 150);
    return () => clearTimeout(timeoutId);
  }, [map, playersWithLocation, selectedPlayerId]);

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

  // Create skillcheck marker with custom icon and popup
  const createSkillcheckMarker = (skillcheck: Skillcheck) => {
    const completedByNames = skillcheck.completedBy.length > 0 
      ? skillcheck.completedBy.map(uid => {
          const player = players.find(p => p.uid === uid);
          return player?.displayName || 'Unknown Player';
        }).join(', ')
      : 'Not completed yet';

    return (
      <Marker
        key={skillcheck.id}
        position={[skillcheck.location.latitude, skillcheck.location.longitude]}
        icon={createSkillcheckIcon(skillcheck)}
      >
        <Popup>
          <div className="glass-card border border-prowl-border/30 p-3 text-sm bg-prowl-bg text-prowl-text">
            <div className="font-bold flex items-center gap-2 text-prowl-text">
              <span>⚡ Skillcheck</span>
              {skillcheck.isCompleted && <span className="text-prowl-success">✓</span>}
            </div>
            <div className="text-xs text-prowl-text-muted mt-2">
              Status: {skillcheck.isCompleted ? 'Completed' : 'Pending'}
            </div>
            {skillcheck.isCompleted && skillcheck.completedAt && (
              <div className="text-xs text-prowl-text-muted">
                Completed: {new Date(skillcheck.completedAt).toLocaleTimeString()}
              </div>
            )}
            <div className="text-xs text-prowl-text-muted mt-1">
              Completed by: {completedByNames}
            </div>
            {!skillcheck.isCompleted && (
              <div className="text-xs text-prowl-warning mt-2 font-medium">
                📍 Get close to start the skillcheck minigame
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    );
  };

  // Create player marker with custom icon and popup
  const createPlayerMarker = (player: Player) => {
    if (!player.location) return null;

    const isCurrentPlayer = player.uid === currentPlayerUid;
    const isSelected = selectedPlayerId === player.uid;
    const distance = currentPlayer?.location && !isCurrentPlayer
      ? getDistance(currentPlayer.location, player.location)
      : null;

    // Check if current player can click on this player
    const canClick = onPlayerClick && (
      // Eliminated players can see everyone
      isEliminated ||
      // Killers can see everyone  
      isKiller ||
      // Survivors can see other survivors but not killers
      (!isKiller && player.role === 'survivor')
    );

    return (
      <Marker
        key={player.uid}
        position={[player.location.latitude, player.location.longitude]}
        icon={createCustomIcon(player, isCurrentPlayer || isSelected)}
        eventHandlers={canClick ? {
          click: () => onPlayerClick(player.uid)
        } : undefined}
      >
        <Popup>
          <div className="glass-card border border-prowl-border/30 p-3 text-sm bg-prowl-bg text-prowl-text">
            <div className="font-bold text-prowl-text">{player.displayName}</div>
            <div className={`text-xs mt-1 ${
              player.role === 'killer' ? 'text-prowl-danger' : 'text-prowl-survivor'
            }`}>
              {player.role === 'killer' ? '🔪 Killer' : '🏃 Survivor'}
              {!player.isAlive && <span className="text-prowl-error"> (Eliminated)</span>}
            </div>
            {distance !== null && (
              <div className="text-xs text-prowl-text mt-1">
                Distance: {distance < 1000 ? `${Math.round(distance)}m` : `${(distance/1000).toFixed(1)}km`}
              </div>
            )}
            <div className="text-xs text-prowl-text-muted mt-1">
              Updated: {formatLastUpdate(player.lastLocationUpdate!)}
            </div>
            {player.location.accuracy && (
              <div className="text-xs text-prowl-text-muted">
                Accuracy: ±{Math.round(player.location.accuracy)}m
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    );
  };

  // Create escape area marker
  const createEscapeAreaMarker = (escapeArea: EscapeArea) => {
    console.log('🗺️ DEBUG: Creating escape area marker:', {
      id: escapeArea.id,
      location: escapeArea.location,
      isRevealed: escapeArea.isRevealed
    });
    
    const escapedPlayerNames = escapeArea.escapedPlayers.length > 0 
      ? escapeArea.escapedPlayers.map(uid => {
          const player = players.find(p => p.uid === uid);
          return player?.displayName || 'Unknown Player';
        }).join(', ')
      : 'None yet';

    return (
      <Marker
        key={escapeArea.id}
        position={[escapeArea.location.latitude, escapeArea.location.longitude]}
        icon={createEscapeAreaIcon()}
      >
        <Popup>
          <div className="glass-card border border-prowl-border/30 p-3 text-sm bg-prowl-bg text-prowl-text">
            <div className="font-bold flex items-center gap-2 text-prowl-text">
              <span>🚪 Escape Area</span>
              <span className="text-purple-400">✨</span>
            </div>
            <div className="text-xs text-prowl-success mt-1 font-medium">
              Status: Escape zone active!
            </div>
            {escapeArea.revealedAt && (
              <div className="text-xs text-prowl-text-muted">
                Revealed: {new Date(escapeArea.revealedAt).toLocaleTimeString()}
              </div>
            )}
            <div className="text-xs text-prowl-text-muted mt-1">
              Escaped players: {escapedPlayerNames}
            </div>
            <div className="text-xs text-purple-400 mt-2 font-medium">
              📍 Get close to escape and win the game!
            </div>
          </div>
        </Popup>
      </Marker>
    );
  };

  // Map is now available to all players during active games
  // No access restriction needed

  if (playersWithLocation.length === 0) {
    const waitingMessage = isKiller 
      ? "📍 Waiting for survivor locations..."
      : "📍 Waiting for player locations...";
    const subMessage = isKiller
      ? "Survivors need to enable location sharing to appear on the map"
      : "Players need to enable location sharing to appear on the map";
      
    return (
      <div className={`glass-card border border-prowl-border/30 p-6 text-center ${className}`}>
        <div className="text-prowl-text">
          <p className="font-semibold text-lg mb-2">{waitingMessage}</p>
          <p className="text-sm text-prowl-text-muted mb-4">{subMessage}</p>
          {!currentPlayer?.location && onEnableLocation && (
            <button
              onClick={onEnableLocation}
              className="btn-primary px-4 py-2 text-sm"
            >
              📍 Enable My Location
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`glass-card border border-prowl-border/30 p-6 text-center ${className}`}>
        <div className="text-prowl-text">
          <p className="font-semibold text-lg flex items-center justify-center gap-2">
            🗺️ Loading map...
          </p>
          <div className="w-6 h-6 border-2 border-prowl-danger border-t-transparent rounded-full animate-spin mx-auto mt-3" />
        </div>
      </div>
    );
  }

  // Dynamic styling and header based on player role
  const getBorderColor = () => {
    if (isEliminated) return 'border-prowl-text-muted/30';
    if (isKiller) return 'border-prowl-danger/30';
    return 'border-prowl-survivor/30';
  };

  const getHeaderBg = () => {
    if (isEliminated) return 'glass-card border-prowl-text-muted/20 bg-prowl-text-muted/5';
    if (isKiller) return 'glass-card border-prowl-danger/20 bg-prowl-danger/5';
    return 'glass-card border-prowl-survivor/20 bg-prowl-survivor/5';
  };

  const getHeaderText = () => {
    if (isEliminated) return 'text-prowl-text';
    if (isKiller) return 'text-prowl-danger';
    return 'text-prowl-survivor';
  };

  const getHeaderTitle = () => {
    if (isEliminated) return '👻 Spectator Map';
    if (isKiller) return '🎯 Killer Tracking Map';
    return '🗺️ Survivor Map';
  };

  const getSubtitleText = () => {
    if (isEliminated) return 'text-prowl-text-muted';
    if (isKiller) return 'text-prowl-danger/80';
    return 'text-prowl-survivor/80';
  };

  const visibleSurvivors = playersWithLocation.filter(p => p.role === 'survivor').length;
  const visibleKillers = playersWithLocation.filter(p => p.role === 'killer').length;

  return (
    <div className={`glass-card border-2 ${getBorderColor()} ${className}`}>
      <div className={`p-4 border-b border-prowl-border/20 ${getHeaderBg()}`}>
        <h3 className={`font-bold text-lg ${getHeaderText()} text-center`}>{getHeaderTitle()}</h3>
        <div className={`text-sm ${getSubtitleText()} text-center mt-2`}>
          {isKiller || isEliminated ? (
            `${visibleSurvivors} survivor${visibleSurvivors !== 1 ? 's' : ''} visible`
          ) : (
            `${visibleSurvivors} survivor${visibleSurvivors !== 1 ? 's' : ''} visible (including you)`
          )}
        </div>
      </div>

      <div className="relative">
        <div 
          style={{ height: '400px', width: '100%' }}
          onClick={onMapClick}
        >
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

            {/* Render skillcheck markers (hidden from killers) */}
            {visibleSkillchecks.map(skillcheck => createSkillcheckMarker(skillcheck))}

            {/* Render escape area marker (hidden from killers) */}
            {visibleEscapeArea && (() => {
              console.log('🗺️ DEBUG: Rendering escape area marker NOW');
              return createEscapeAreaMarker(visibleEscapeArea);
            })()}

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
        <div className="absolute bottom-4 left-4 glass-card border border-prowl-border/30 p-3 text-xs shadow-xl z-[1000]">
          <div className="font-semibold text-prowl-text mb-2 flex items-center gap-1">
            🗺️ Legend
          </div>
          
          {/* Current player marker */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-4 h-4 rounded-full border-2 border-prowl-surface ${
              isKiller ? 'bg-prowl-danger' : 'bg-prowl-survivor'
            }`}></div>
            <span className="text-prowl-text font-medium">
              You ({isKiller ? '🔪 Killer' : '🛡️ Survivor'})
            </span>
          </div>
          
          {/* Other survivors (always visible to all) */}
          {visibleSurvivors > (isKiller ? 0 : 1) && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-prowl-survivor border-2 border-prowl-surface"></div>
              <span className="text-prowl-text-muted">Other Survivors</span>
            </div>
          )}
          
          {/* Other killers (only visible to killers and eliminated players) */}
          {(isKiller || isEliminated) && playersWithLocation.some(p => p.role === 'killer' && p.uid !== currentPlayerUid) && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-prowl-danger border-2 border-prowl-surface"></div>
              <span className="text-prowl-text-muted">Other Killers</span>
            </div>
          )}
          
          {/* Skillchecks (only visible to survivors and eliminated players) */}
          {visibleSkillchecks.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-prowl-warning border-2 border-prowl-surface"></div>
                <span className="text-prowl-text-muted">⚡ Pending Skillchecks</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-prowl-success border-2 border-prowl-surface"></div>
                <span className="text-prowl-text-muted">✅ Completed Skillchecks</span>
              </div>
            </>
          )}
          
          {/* Escape Area (only visible to survivors and eliminated players) */}
          {visibleEscapeArea && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-prowl-surface"></div>
              <span className="text-prowl-text-muted">🚪 Escape Area</span>
            </div>
          )}
          
          {/* Selected player info */}
          {selectedPlayerId && (
            <div className="text-xs text-prowl-survivor mt-2 pt-2 border-t border-prowl-border/30">
              📍 Viewing: {playersWithLocation.find(p => p.uid === selectedPlayerId)?.displayName}
            </div>
          )}
          
          {/* Note for survivors */}
          {!isKiller && !isEliminated && (
            <div className="text-xs text-prowl-text-muted mt-2 italic">
              🔒 Killers are hidden from your view
            </div>
          )}
          
          {/* Click instruction */}
          {(onPlayerClick || onMapClick) && (
            <div className="text-xs text-prowl-text-muted mt-2 italic">
              👆 Click players to view • Click map to reset view
            </div>
          )}
        </div>

        {/* Controls hint */}
        <div className="absolute top-4 right-4 glass-card border border-prowl-border/30 p-2 text-xs shadow-lg z-[1000]">
          <div className="text-prowl-text-muted font-medium">
            📱 Pinch to zoom • Drag to pan
          </div>
        </div>
      </div>

      {/* Update info */}
      <div className="p-3 text-xs text-prowl-text-muted text-center border-t border-prowl-border/20">
        🔄 Updates every 5 seconds • 📍 Tap markers for details
      </div>
    </div>
  );
}

// Export memoized component for performance
export default memo(InteractiveGameMap);