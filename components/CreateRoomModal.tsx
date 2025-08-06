'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { createRoom } from '@/lib/gameService';
import { RoomSettings, PlayerLocation } from '@/types/game';
import { locationService } from '@/lib/locationService';
import dynamic from 'next/dynamic';
import { useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// Icons will be created dynamically on client side to avoid SSR issues

// Dynamically import map components to avoid SSR issues
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

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomCode: string) => void;
}

export default function CreateRoomModal({
  isOpen,
  onClose,
  onRoomCreated,
}: CreateRoomModalProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>({
    killerCount: 1,
    roundLengthMinutes: 15,
    headstartMinutes: 3,
    maxPlayers: 15,
  });
  const [skillchecksEnabled, setSkillchecksEnabled] = useState(false);
  const [skillcheckCount, setSkillcheckCount] = useState(3);
  const [skillcheckDistance, setSkillcheckDistance] = useState(200); // 200 meters default
  const [pinnedLocation, setPinnedLocation] = useState<PlayerLocation | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.7749, -122.4194]); // Default to SF
  const [locationError, setLocationError] = useState<string>('');
  const [userLocation, setUserLocation] = useState<PlayerLocation | null>(null);

  // Create Leaflet icons dynamically on client side
  const createLeafletIcons = () => {
    if (typeof window === 'undefined') return null;
    
    const L = require('leaflet');
    
    // Configure default Leaflet icons
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const pinIcon = new L.Icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const createProfileIcon = (profilePictureUrl: string | null, displayName: string) => {
      const initials = displayName[0]?.toUpperCase() || 'U';
      
      return new L.DivIcon({
        html: profilePictureUrl 
          ? `<div style="width: 40px; height: 40px; border-radius: 50%; border: 3px solid #3B82F6; overflow: hidden; background-color: white;">
               <img src="${profilePictureUrl}" alt="Your location" style="width: 100%; height: 100%; object-fit: cover;" />
             </div>`
          : `<div style="width: 40px; height: 40px; border-radius: 50%; border: 3px solid #3B82F6; background-color: #9CA3AF; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold;">
               ${initials}
             </div>`,
        className: 'profile-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    };

    return { pinIcon, createProfileIcon };
  };

  // Get user's current location for initial map center
  useEffect(() => {
    if (skillchecksEnabled && showLocationPicker) {
      locationService.getCurrentLocation()
        .then((location) => {
          setMapCenter([location.latitude, location.longitude]);
          setUserLocation(location);
        })
        .catch(() => {
          // Keep default location if GPS fails
        });
    }
  }, [skillchecksEnabled, showLocationPicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setLoading(true);
    try {
      console.log('CreateRoom: Starting room creation for user:', user.id);
      console.log('CreateRoom: Profile data:', profile);
      
      // Check if location is required for skillchecks
      if (skillchecksEnabled && !pinnedLocation) {
        setLocationError('Please pin a location for skillcheck placement');
        setLoading(false);
        return;
      }

      const finalSettings: RoomSettings = {
        ...settings,
        skillchecks: skillchecksEnabled ? {
          enabled: true,
          count: skillcheckCount,
          maxDistanceFromHost: skillcheckDistance
        } : undefined
      };
      
      console.log('CreateRoom: Settings:', finalSettings);
      
      const roomCode = await createRoom(
        user.id,
        {
          displayName: profile.custom_username || profile.display_name,
          profilePictureUrl: profile.profile_picture_url,
        },
        finalSettings,
        pinnedLocation || undefined // Pass pinned location for skillcheck generation
      );
      
      console.log('CreateRoom: Room created successfully with code:', roomCode);
      onRoomCreated(roomCode);
    } catch (error: any) {
      console.error('Error creating room:', error);
      console.error('Error details:', error);
      const errorMessage = error?.message || 'Failed to create room. Please try again.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Map click handler component
  const MapClickHandler = ({ onLocationSelect }: { onLocationSelect: (location: PlayerLocation) => void }) => {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        onLocationSelect({
          latitude: lat,
          longitude: lng,
        });
      },
    });
    return null;
  };

  const handleLocationSelect = (location: PlayerLocation) => {
    setPinnedLocation(location);
    setLocationError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="glass-modal w-full max-w-lg text-granny-text my-8 max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-granny-border/30">
          <div>
            <h2 className="text-2xl font-bold text-granny-text mb-1">🎮 Create Room</h2>
            <p className="text-sm text-granny-text-muted">Configure your horror game session</p>
          </div>
          <button
            onClick={onClose}
            className="text-granny-text-muted hover:text-granny-text text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-granny-surface-light transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-semibold text-granny-text mb-3 flex items-center gap-2">
              🔪 Number of Killers
            </label>
            <select
              value={settings.killerCount}
              onChange={(e) =>
                setSettings({ ...settings, killerCount: parseInt(e.target.value) })
              }
              className="input-field w-full"
            >
              <option value={1}>1 Killer</option>
              <option value={2}>2 Killers</option>
              <option value={3}>3 Killers</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-granny-text mb-3 flex items-center gap-2">
              ⏱️ Round Length
            </label>
            <select
              value={settings.roundLengthMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  roundLengthMinutes: parseFloat(e.target.value),
                })
              }
              className="input-field w-full"
            >
              <option value={0.5}>30 seconds (testing)</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-granny-text mb-3 flex items-center gap-2">
              🏃 Headstart Time
            </label>
            <select
              value={settings.headstartMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  headstartMinutes: parseFloat(e.target.value),
                })
              }
              className="input-field w-full"
            >
              <option value={0.083}>5 seconds (testing)</option>
              <option value={1}>1 minute</option>
              <option value={3}>3 minutes</option>
              <option value={5}>5 minutes</option>
            </select>
            <p className="text-xs text-granny-text-muted mt-2">
              Time for survivors to hide before the hunt begins
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-granny-text mb-3 flex items-center gap-2">
              👥 Max Players
            </label>
            <select
              value={settings.maxPlayers}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxPlayers: parseInt(e.target.value),
                })
              }
              className="input-field w-full"
            >
              <option value={5}>5 players</option>
              <option value={8}>8 players</option>
              <option value={10}>10 players</option>
              <option value={12}>12 players</option>
              <option value={15}>15 players</option>
            </select>
          </div>

          {/* Skillcheck System Section */}
          <div className="glass-card p-4 border border-granny-border/30">
            <div className="flex items-start gap-3 mb-3">
              <input
                type="checkbox"
                id="skillchecksEnabled"
                checked={skillchecksEnabled}
                onChange={(e) => setSkillchecksEnabled(e.target.checked)}
                className="h-5 w-5 mt-0.5 text-granny-danger focus:ring-granny-danger/50 bg-granny-surface border-granny-border rounded"
              />
              <div>
                <label htmlFor="skillchecksEnabled" className="text-sm font-semibold text-granny-text block">
                  🎯 Enable Skillchecks (Dead by Daylight style)
                </label>
                <p className="text-xs text-granny-text-muted mt-1">
                  Survivors must complete objectives while avoiding killers
                </p>
              </div>
            </div>

            {skillchecksEnabled && (
              <div className="space-y-4">
                {locationError && (
                  <div className="bg-granny-error/10 border border-granny-error/30 rounded-lg p-3">
                    <p className="text-granny-error text-sm">⚠️ {locationError}</p>
                  </div>
                )}

                {/* Location Picker */}
                <div>
                  <label className="block text-sm font-semibold text-granny-text mb-3">
                    📍 Skillcheck Center Location
                  </label>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(!showLocationPicker)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                        pinnedLocation 
                          ? 'border-granny-success/50 bg-granny-success/10 hover:bg-granny-success/15' 
                          : 'border-granny-border bg-granny-surface hover:bg-granny-surface-light'
                      }`}
                    >
                      {pinnedLocation ? (
                        <div>
                          <div className="text-granny-success font-semibold mb-1">📍 Location Selected</div>
                          <div className="text-xs text-granny-text-muted">
                            {pinnedLocation.latitude.toFixed(6)}, {pinnedLocation.longitude.toFixed(6)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-granny-text font-semibold mb-1">🗺️ Click to Pin Location</div>
                          <div className="text-xs text-granny-text-muted">
                            Choose where skillchecks will be centered around
                          </div>
                        </div>
                      )}
                    </button>
                    
                    {showLocationPicker && (
                      <div className="border border-granny-border rounded-lg overflow-hidden bg-granny-surface">
                        <div style={{ height: '200px', width: '100%' }}>
                          <MapContainer
                            center={mapCenter}
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapClickHandler onLocationSelect={handleLocationSelect} />
                            {/* User's current location as reference */}
                            {userLocation && profile && (() => {
                              const icons = createLeafletIcons();
                              return icons ? (
                                <Marker 
                                  position={[userLocation.latitude, userLocation.longitude]}
                                  icon={icons.createProfileIcon(
                                    profile.profile_picture_url || null,
                                    profile.custom_username || profile.display_name || 'User'
                                  )}
                                />
                              ) : null;
                            })()}
                            {/* Pin marker for skillcheck location */}
                            {pinnedLocation && (() => {
                              const icons = createLeafletIcons();
                              return icons ? (
                                <Marker 
                                  position={[pinnedLocation.latitude, pinnedLocation.longitude]} 
                                  icon={icons.pinIcon}
                                />
                              ) : null;
                            })()}
                          </MapContainer>
                        </div>
                        <div className="bg-granny-surface-light p-3 text-xs text-granny-text-muted border-t border-granny-border">
                          <p className="mb-1">🔵 Blue marker = Your current location (reference)</p>
                          <p>📍 Red pin = Click anywhere to set skillcheck center</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-granny-text mb-3">
                    🎯 Number of Skillchecks: <span className="text-granny-danger">{skillcheckCount}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={skillcheckCount}
                    onChange={(e) => setSkillcheckCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-granny-surface rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #c41e3a 0%, #c41e3a ${((skillcheckCount - 1) / 7) * 100}%, #1a1a1d ${((skillcheckCount - 1) / 7) * 100}%, #1a1a1d 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-granny-text-muted mt-2">
                    <span>1 objective</span>
                    <span>8 objectives</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-granny-text mb-3">
                    📏 Max Distance: <span className="text-granny-survivor">{skillcheckDistance}m</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="25"
                    value={skillcheckDistance}
                    onChange={(e) => setSkillcheckDistance(parseInt(e.target.value))}
                    className="w-full h-2 bg-granny-surface rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #2d5a3d 0%, #2d5a3d ${((skillcheckDistance - 50) / 950) * 100}%, #1a1a1d ${((skillcheckDistance - 50) / 950) * 100}%, #1a1a1d 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-granny-text-muted mt-2">
                    <span>50m (tight)</span>
                    <span>1000m (spread)</span>
                  </div>
                  <p className="text-xs text-granny-text-muted mt-2">
                    Objectives randomly scattered within this radius from center
                  </p>
                </div>

                <div className="glass-card p-4 border border-granny-warning/30">
                  <h4 className="font-semibold text-granny-warning mb-2 text-sm flex items-center gap-2">📋 Skillcheck Rules:</h4>
                  <ul className="text-xs text-granny-text-muted space-y-1">
                    <li className="flex items-center gap-2"><span className="text-granny-danger">•</span> Complete ALL objectives + survive timer</li>
                    <li className="flex items-center gap-2"><span className="text-granny-danger">•</span> 30s timing challenge per objective</li>
                    <li className="flex items-center gap-2"><span className="text-granny-survivor">•</span> Co-op: survivors can work together</li>
                    <li className="flex items-center gap-2"><span className="text-granny-survivor">•</span> Hidden from killer maps</li>
                    <li className="flex items-center gap-2"><span className="text-granny-warning">•</span> Unlock escape area when complete</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

        </form>
        
        <div className="flex gap-4 p-6 pt-4 border-t border-granny-border/30">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost flex-1 py-3"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn-primary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </div>
            ) : (
              <>🎮 Create Room</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}