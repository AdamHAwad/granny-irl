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
          <div className="text-xl text-granny-text mb-4 flex items-center justify-center gap-2">
            🏆 Loading results...
          </div>
          <div className="w-8 h-8 border-2 border-granny-warning border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  if (error || !gameResult) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
        <div className="glass-card p-8 text-center animate-slide-up relative z-10">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-granny-text mb-4">Results Error</h1>
          <p className="text-granny-error mb-6">{error || 'Results not found'}</p>
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
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
      
      <div className="w-full glass-modal p-8 text-granny-text animate-slide-up relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-granny-text mb-4 flex items-center justify-center gap-3">
            🏆 Game Results
          </h1>
          <div className={`text-8xl font-bold mb-6 animate-glow ${
            gameResult.winners === 'killers' ? 'text-granny-danger' : 'text-granny-survivor'
          }`}>
            {gameResult.winners === 'killers' ? '💀 KILLERS WIN!' : '🛡️ SURVIVORS WIN!'}
          </div>
          <div className="glass-card p-4 border border-granny-border/30 inline-block">
            <p className="text-granny-text-muted flex items-center gap-2">
              ⏱️ Game Duration: <span className="text-granny-text font-semibold">{gameDurationMin}m {gameDurationSec}s</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-granny-success flex items-center gap-2">
              🏆 Winners ({winners.length})
            </h2>
            <div className="space-y-3">
              {winners.map((player) => (
                <PlayerCard key={player.uid} player={player} isWinner={true} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4 text-granny-error flex items-center gap-2">
              💀 Eliminated ({losers.length})
            </h2>
            <div className="space-y-3">
              {gameResult.elimination_order.map((uid, index) => {
                const player = gameResult.final_players[uid];
                if (!player) return null;
                return (
                  <div key={uid} className="glass-card border border-granny-error/30 bg-granny-error/5">
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 bg-granny-error/20 border border-granny-error/50 rounded-full flex items-center justify-center">
                        <span className="text-granny-error font-bold text-sm">#{index + 1}</span>
                      </div>
                      <PlayerCard player={player} isWinner={false} showElimination={true} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-6 border-t border-granny-border/30">
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
        ? 'border-granny-success/50 bg-granny-success/10 hover:border-granny-success/70' 
        : showElimination 
          ? 'bg-transparent border-none p-0' 
          : 'border-granny-border/30 hover:border-granny-border/50'
    }`}>
      <div className="flex items-center gap-4">
        {player.profilePictureUrl ? (
          <div className="relative">
            <img
              src={player.profilePictureUrl}
              alt={player.displayName}
              className={`w-12 h-12 rounded-full object-cover border-2 ${
                isWinner 
                  ? 'border-granny-success/70' 
                  : player.role === 'killer' 
                    ? 'border-granny-danger/50' 
                    : 'border-granny-survivor/50'
              }`}
            />
            {isWinner && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-granny-success rounded-full flex items-center justify-center">
                <span className="text-xs">🏆</span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
              isWinner 
                ? 'bg-granny-success/20 border-granny-success/70' 
                : player.role === 'killer' 
                  ? 'bg-granny-danger/20 border-granny-danger/50' 
                  : 'bg-granny-survivor/20 border-granny-survivor/50'
            }`}>
              <span className="text-sm font-bold text-granny-text">
                {player.displayName[0]?.toUpperCase()}
              </span>
            </div>
            {isWinner && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-granny-success rounded-full flex items-center justify-center">
                <span className="text-xs">🏆</span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1">
          <p className="font-semibold text-granny-text">{player.displayName}</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              player.role === 'killer' 
                ? 'bg-granny-danger/20 text-granny-danger' 
                : 'bg-granny-survivor/20 text-granny-survivor'
            }`}>
              {player.role === 'killer' ? '🔪' : '🛡️'} {player.role?.toUpperCase()}
            </span>
            {isWinner && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-granny-success/20 text-granny-success">
                🏆 WINNER
              </span>
            )}
          </div>
          {showElimination && player.eliminatedAt && (
            <p className="text-xs text-granny-text-muted mt-1 flex items-center gap-1">
              ⏰ Eliminated at {new Date(player.eliminatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="flex flex-col items-center gap-1">
          {isWinner && <div className="text-3xl animate-bounce">🏆</div>}
          {!isWinner && !player.isAlive && <div className="text-2xl text-granny-error">💀</div>}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPageWrapper({ params }: PageProps) {
  return (
    <AuthGuard fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
        <div className="glass-card p-8 text-center animate-slide-up relative z-10">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-granny-text text-lg mb-4">Please sign in to view results</p>
          <p className="text-granny-text-muted text-sm">See how the hunt concluded</p>
        </div>
      </main>
    }>
      <ResultsPage params={params} />
    </AuthGuard>
  );
}