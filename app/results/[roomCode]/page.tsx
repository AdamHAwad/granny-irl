'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getGameResult } from '@/lib/gameService';
import { GameResult } from '@/types/game';
import AuthGuard from '@/components/AuthGuard';

interface PageProps {
  params: {
    roomCode: string;
  };
}

function ResultsPage({ params }: PageProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const fetchResults = async () => {
      try {
        const result = await getGameResult(params.roomCode);
        if (!result) {
          setError('Game results not found');
          return;
        }
        setGameResult(result);
      } catch (error) {
        console.error('Error fetching game results:', error);
        setError('Failed to load game results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [params.roomCode]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="glass-card p-8 text-center animate-slide-up">
          <div className="text-xl text-prowl-text mb-4 flex items-center justify-center gap-2">
            🏆 Loading results...
          </div>
          <div className="w-8 h-8 border-2 border-prowl-warning border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  if (error || !gameResult) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-prowl-bg/80 to-prowl-bg pointer-events-none" />
        <div className="glass-card p-8 text-center animate-slide-up relative z-10">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-prowl-text mb-4">Results Error</h1>
          <p className="text-prowl-error mb-6">{error || 'Results not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary px-6 py-3"
          >
            🏠 Back to Home
          </button>
        </div>
      </main>
    );
  }

  const players = Object.values(gameResult.final_players);
  const winners = players.filter(p => 
    gameResult.winners === 'killers' ? p.role === 'killer' : p.role === 'survivor' && p.isAlive
  );
  const losers = players.filter(p => 
    gameResult.winners === 'killers' ? p.role === 'survivor' || !p.isAlive : p.role === 'killer'
  );

  const gameDurationMs = gameResult.game_ended_at - gameResult.game_started_at;
  const gameDurationMin = Math.floor(gameDurationMs / 60000);
  const gameDurationSec = Math.floor((gameDurationMs % 60000) / 1000);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 max-w-3xl mx-auto relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-prowl-bg/80 to-prowl-bg pointer-events-none" />
      
      <div className="w-full glass-modal p-8 text-prowl-text animate-slide-up relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-prowl-text mb-4 flex items-center justify-center gap-3">
            🏆 Game Results
          </h1>
          <div className="mb-8 px-4">
            <div className="text-6xl mb-4">
              {gameResult.winners === 'killers' ? '💀' : '🛡️'}
            </div>
            <div className={`text-3xl sm:text-5xl md:text-6xl font-bold mb-4 break-words ${
              gameResult.winners === 'killers' ? 'text-prowl-danger' : 'text-prowl-survivor'
            }`}>
              {gameResult.winners === 'killers' ? 'KILLERS WIN!' : 'SURVIVORS WIN!'}
            </div>
          </div>
          <div className="glass-card p-4 border border-prowl-border/30 inline-block">
            <p className="text-prowl-text-muted flex items-center gap-2">
              ⏱️ Game Duration: <span className="text-prowl-text font-semibold">{gameDurationMin}m {gameDurationSec}s</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-prowl-success flex items-center gap-2">
              🏆 Winners ({winners.length})
            </h2>
            <div className="space-y-3">
              {winners.map((player) => (
                <PlayerCard key={player.uid} player={player} isWinner={true} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4 text-prowl-error flex items-center gap-2">
              💀 Eliminated ({losers.length})
            </h2>
            <div className="space-y-3">
              {gameResult.elimination_order.map((uid, index) => {
                const player = gameResult.final_players[uid];
                if (!player) return null;
                return (
                  <div key={uid} className="glass-card border border-prowl-error/30 bg-prowl-error/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-prowl-error/20 border border-prowl-error/50 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-prowl-error font-bold text-xs sm:text-sm">#{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <PlayerCard player={player} isWinner={false} showElimination={true} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-6 border-t border-prowl-border/30">
          <button
            onClick={() => router.push('/')}
            className="btn-primary px-8 py-4 text-lg"
          >
            🏠 Return to Home
          </button>
        </div>
      </div>
    </main>
  );
}

function PlayerCard({ 
  player, 
  isWinner, 
  showElimination = false 
}: { 
  player: any; 
  isWinner: boolean; 
  showElimination?: boolean;
}) {
  return (
    <div className={`glass-card p-4 border transition-all duration-200 ${
      isWinner 
        ? 'border-prowl-success/50 bg-prowl-success/10 hover:border-prowl-success/70' 
        : showElimination 
          ? 'bg-transparent border-none p-0' 
          : 'border-prowl-border/30 hover:border-prowl-border/50'
    }`}>
      <div className="flex items-center gap-4">
        {player.profilePictureUrl ? (
          <div className="relative">
            <img
              src={player.profilePictureUrl}
              alt={player.displayName}
              className={`w-12 h-12 rounded-full object-cover border-2 ${
                isWinner 
                  ? 'border-prowl-success/70' 
                  : player.role === 'killer' 
                    ? 'border-prowl-danger/50' 
                    : 'border-prowl-survivor/50'
              }`}
            />
            {isWinner && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-prowl-success rounded-full flex items-center justify-center">
                <span className="text-xs">🏆</span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
              isWinner 
                ? 'bg-prowl-success/20 border-prowl-success/70' 
                : player.role === 'killer' 
                  ? 'bg-prowl-danger/20 border-prowl-danger/50' 
                  : 'bg-prowl-survivor/20 border-prowl-survivor/50'
            }`}>
              <span className="text-sm font-bold text-prowl-text">
                {player.displayName[0]?.toUpperCase()}
              </span>
            </div>
            {isWinner && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-prowl-success rounded-full flex items-center justify-center">
                <span className="text-xs">🏆</span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-prowl-text text-sm sm:text-base truncate">{player.displayName}</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
            <span className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${
              player.role === 'killer' 
                ? 'bg-prowl-danger/20 text-prowl-danger' 
                : 'bg-prowl-survivor/20 text-prowl-survivor'
            }`}>
              {player.role === 'killer' ? '🔪' : '🛡️'} {player.role?.toUpperCase()}
            </span>
            {isWinner && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-prowl-success/20 text-prowl-success inline-flex items-center gap-1">
                🏆 WINNER
              </span>
            )}
          </div>
          {showElimination && player.eliminatedAt && (
            <p className="text-xs text-prowl-text-muted mt-2 flex items-center gap-1">
              ⏰ Eliminated at {new Date(player.eliminatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="flex flex-col items-center gap-1">
          {isWinner && <div className="text-3xl animate-bounce">🏆</div>}
          {!isWinner && !player.isAlive && <div className="text-2xl text-prowl-error">💀</div>}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPageWrapper({ params }: PageProps) {
  return (
    <AuthGuard fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-prowl-bg/80 to-prowl-bg pointer-events-none" />
        <div className="glass-card p-8 text-center animate-slide-up relative z-10">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-prowl-text text-lg mb-4">Please sign in to view results</p>
          <p className="text-prowl-text-muted text-sm">See how the hunt concluded</p>
        </div>
      </main>
    }>
      <ResultsPage params={params} />
    </AuthGuard>
  );
}