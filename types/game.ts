export interface Player {
  uid: string;
  displayName: string;
  profilePictureUrl?: string;
  role?: 'killer' | 'survivor';
  isAlive: boolean;
  eliminatedAt?: number;
  eliminatedBy?: string;
  location?: PlayerLocation;
  lastLocationUpdate?: number;
}

export interface PlayerLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number; // Device compass heading in degrees (0-360)
}

export interface GameBoundary {
  center: PlayerLocation; // Host's location when boundary was set
  radiusMeters: number; // Boundary radius in meters
}

export interface RoomSettings {
  killerCount: number; // 1-3
  roundLengthMinutes: number; // 0.5 (30s testing), 5, 10, 15, 20, 30
  headstartMinutes: number; // 0.083 (5s testing), 1, 3, 5
  maxPlayers: number; // default 15
  boundary?: GameBoundary; // Optional game boundary
}

export interface Room {
  id: string; // 6-digit code
  host_uid: string;
  players: { [uid: string]: Player };
  settings: RoomSettings;
  status: 'waiting' | 'headstart' | 'active' | 'finished';
  created_at: number;
  headstart_started_at?: number;
  game_started_at?: number;
  game_ended_at?: number;
}

export interface GameResult {
  room_id: string;
  winners: 'killers' | 'survivors';
  elimination_order: string[]; // array of UIDs in elimination order
  game_started_at: number;
  game_ended_at: number;
  final_players: { [uid: string]: Player };
}

export type GameStatus = 'waiting' | 'headstart' | 'active' | 'finished';

export interface PlayerGameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  killerWins: number;
  survivorWins: number;
  avgPlacement: number;
  totalEliminations: number; // times this player was eliminated
}

export interface GameHistoryEntry {
  room_id: string;
  winners: 'killers' | 'survivors';
  game_started_at: number;
  game_ended_at: number;
  playerRole: 'killer' | 'survivor';
  playerWon: boolean;
  placement: number; // 1st place = winner, 2nd = first eliminated, etc.
  gameDurationMinutes: number;
}