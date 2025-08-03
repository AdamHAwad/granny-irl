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

  // Get user's current location for initial map center
  useEffect(() => {
    if (skillchecksEnabled && showLocationPicker) {
      locationService.getCurrentLocation()
        .then((location) => {
          setMapCenter([location.latitude, location.longitude]);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-md text-black my-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 pb-0">
          <h2 className="text-2xl font-bold">Create Room</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Killers
            </label>
            <select
              value={settings.killerCount}
              onChange={(e) =>
                setSettings({ ...settings, killerCount: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Killer</option>
              <option value={2}>2 Killers</option>
              <option value={3}>3 Killers</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Round Length
            </label>
            <select
              value={settings.roundLengthMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  roundLengthMinutes: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Headstart Time
            </label>
            <select
              value={settings.headstartMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  headstartMinutes: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0.083}>5 seconds (testing)</option>
              <option value={1}>1 minute</option>
              <option value={3}>3 minutes</option>
              <option value={5}>5 minutes</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Time for survivors to hide before the round starts
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Players
            </label>
            <select
              value={settings.maxPlayers}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxPlayers: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5 players</option>
              <option value={8}>8 players</option>
              <option value={10}>10 players</option>
              <option value={12}>12 players</option>
              <option value={15}>15 players</option>
            </select>
          </div>

          {/* Skillcheck System Section */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="skillchecksEnabled"
                checked={skillchecksEnabled}
                onChange={(e) => setSkillchecksEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="skillchecksEnabled" className="text-sm font-medium text-gray-700">
                🎯 Enable Skillchecks (Dead by Daylight style)
              </label>
            </div>
            
            <p className="text-xs text-gray-500 mb-2">
              Survivors must complete objectives while avoiding killers.
            </p>

            {skillchecksEnabled && (
              <div className="space-y-4">
                {locationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm">⚠️ {locationError}</p>
                  </div>
                )}

                {/* Location Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skillcheck Center Location
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(!showLocationPicker)}
                      className={`w-full p-3 rounded-lg border-2 text-left ${
                        pinnedLocation 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-300 bg-gray-50'
                      }`}
                    >
                      {pinnedLocation ? (
                        <div>
                          <div className="text-green-700 font-medium">📍 Location Selected</div>
                          <div className="text-xs text-green-600">
                            {pinnedLocation.latitude.toFixed(6)}, {pinnedLocation.longitude.toFixed(6)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-gray-700 font-medium">🗺️ Click to Pin Location</div>
                          <div className="text-xs text-gray-500">
                            Choose where skillchecks will be centered
                          </div>
                        </div>
                      )}
                    </button>
                    
                    {showLocationPicker && (
                      <div className="border rounded-lg overflow-hidden">
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
                            {pinnedLocation && (
                              <Marker position={[pinnedLocation.latitude, pinnedLocation.longitude]} />
                            )}
                          </MapContainer>
                        </div>
                        <div className="bg-blue-50 p-2 text-xs text-blue-700">
                          Click anywhere on the map to pin the skillcheck center location
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Skillchecks: {skillcheckCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={skillcheckCount}
                    onChange={(e) => setSkillcheckCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 skillcheck</span>
                    <span>8 skillchecks</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Distance from Pinned Location: {skillcheckDistance}m
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="25"
                    value={skillcheckDistance}
                    onChange={(e) => setSkillcheckDistance(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50m (close)</span>
                    <span>1000m (spread out)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Skillchecks will be randomly placed within this distance from the pinned location.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <h4 className="font-medium text-blue-800 mb-1 text-sm">📋 Rules:</h4>
                  <ul className="text-xs text-blue-700 space-y-0.5">
                    <li>• Complete ALL skillchecks + survive timer</li>
                    <li>• 30s timing challenge per skillcheck</li>
                    <li>• Failures add +30s to round timer</li>
                    <li>• Co-op: work together allowed</li>
                    <li>• Hidden from killer maps</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

        </form>
        
        <div className="flex gap-3 p-6 pt-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 bg-white"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}