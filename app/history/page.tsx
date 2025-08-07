'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayerGameHistory, getPlayerGameStats } from '@/lib/gameService';
import { GameHistoryEntry, PlayerGameStats } from '@/types/game';
import AuthGuard from '@/components/AuthGuard';

function GameHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [stats, setStats] = useState<PlayerGameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        console.log('GameHistoryPage: Fetching data for user:', user.id);
        const [historyData, statsData] = await Promise.all([
          getPlayerGameHistory(user.id),
          getPlayerGameStats(user.id)
        ]);
        
        setHistory(historyData);
        setStats(statsData);
      } catch (error) {
        console.error('Error fetching game history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="glass-card p-8 text-center animate-slide-up">
          <div className="text-xl text-granny-text mb-4 flex items-center justify-center gap-2">
            📊 Loading game history...
          </div>
          <div className="w-8 h-8 border-2 border-granny-danger border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 max-w-6xl mx-auto relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
      
      <div className="w-full glass-modal p-8 text-granny-text mb-6 animate-slide-up relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-granny-text mb-2 flex items-center gap-3">
              📊 Game History
            </h1>
            <p className="text-granny-text-muted">Your survival statistics and recent games</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="btn-ghost px-6 py-3 flex items-center gap-2"
          >
            🏠 Back to Home
          </button>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-6 text-granny-text flex items-center gap-2">
              📈 Your Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-6 text-center border border-granny-border/30 hover:border-granny-border/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-text mb-2">{stats.gamesPlayed}</div>
                <div className="text-sm text-granny-text-muted font-medium">🎮 Games Played</div>
              </div>
              <div className="glass-card p-6 text-center border border-granny-success/30 hover:border-granny-success/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-success mb-2">{stats.wins}</div>
                <div className="text-sm text-granny-text-muted font-medium">🏆 Wins</div>
              </div>
              <div className="glass-card p-6 text-center border border-granny-error/30 hover:border-granny-error/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-error mb-2">{stats.losses}</div>
                <div className="text-sm text-granny-text-muted font-medium">💀 Losses</div>
              </div>
              <div className="glass-card p-6 text-center border border-granny-warning/30 hover:border-granny-warning/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-warning mb-2">{stats.avgPlacement}</div>
                <div className="text-sm text-granny-text-muted font-medium">📍 Avg Placement</div>
              </div>
              <div className="glass-card p-6 text-center border border-granny-danger/30 hover:border-granny-danger/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-danger mb-2">{stats.killerWins}</div>
                <div className="text-sm text-granny-text-muted font-medium">🔪 Killer Wins</div>
              </div>
              <div className="glass-card p-6 text-center border border-granny-survivor/30 hover:border-granny-survivor/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-survivor mb-2">{stats.survivorWins}</div>
                <div className="text-sm text-granny-text-muted font-medium">🛡️ Survivor Wins</div>
              </div>
              <div className="glass-card p-6 text-center border border-granny-border/30 hover:border-granny-border/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-text-muted mb-2">{stats.totalEliminations}</div>
                <div className="text-sm text-granny-text-muted font-medium">⚰️ Times Eliminated</div>
              </div>
              <div className="glass-card p-6 text-center border border-granny-warning/30 hover:border-granny-warning/50 transition-all duration-200">
                <div className="text-3xl font-bold text-granny-warning mb-2">
                  {stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}%
                </div>
                <div className="text-sm text-granny-text-muted font-medium">📊 Win Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Game History */}
        <div>
          <h2 className="text-2xl font-bold mb-6 text-granny-text flex items-center gap-2">
            🕒 Recent Games ({history.length})
          </h2>
          
          {history.length === 0 ? (
            <div className="glass-card p-12 text-center border border-granny-border/30">
              <div className="text-6xl mb-4">🎮</div>
              <p className="text-granny-text-muted mb-6 text-lg">No games played yet!</p>
              <p className="text-granny-text-muted mb-6 text-sm">Start your survival journey and face the horrors that await</p>
              <button
                onClick={() => router.push('/')}
                className="btn-primary px-8 py-4 text-lg"
              >
                🎯 Play Your First Game
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((game, index) => (
                <div
                  key={`${game.room_id}-${game.game_ended_at}`}
                  className={`glass-card p-6 border-2 transition-all duration-200 hover:scale-[1.01] ${
                    game.playerWon 
                      ? 'border-granny-success/30 hover:border-granny-success/50 hover:shadow-lg hover:shadow-granny-success/10' 
                      : 'border-granny-error/30 hover:border-granny-error/50 hover:shadow-lg hover:shadow-granny-error/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1 ${
                        game.playerWon 
                          ? 'bg-granny-success/20 text-granny-success border border-granny-success/30' 
                          : 'bg-granny-error/20 text-granny-error border border-granny-error/30'
                      }`}>
                        {game.playerWon ? '🏆 WON' : '💀 LOST'}
                      </div>
                      
                      <div className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1 ${
                        game.playerRole === 'killer' 
                          ? 'bg-granny-danger/20 text-granny-danger border border-granny-danger/30' 
                          : 'bg-granny-survivor/20 text-granny-survivor border border-granny-survivor/30'
                      }`}>
                        {game.playerRole === 'killer' ? '🔪 KILLER' : '🛡️ SURVIVOR'}
                      </div>
                      
                      <div className="text-xs sm:text-sm text-granny-text-muted font-mono">
                        Room: <span className="text-granny-text font-semibold">{game.room_id}</span>
                      </div>
                    </div>
                    
                    <div className="text-left sm:text-right flex-shrink-0">
                      <div className="text-xs sm:text-sm font-semibold text-granny-text">
                        {formatDate(game.game_ended_at)}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-granny-text">
                        at {formatTime(game.game_ended_at)}
                      </div>
                      <div className="text-xs text-granny-text-muted mt-1">
                        ⏱️ {game.gameDurationMinutes} min • 📍 Placement: #{game.placement}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-sm text-granny-text-muted border-t border-granny-border/20 pt-3">
                    <span className={`font-semibold ${
                      game.winners === 'killers' ? 'text-granny-danger' : 'text-granny-survivor'
                    }`}>
                      {game.winners === 'killers' ? '🔪 Killers won' : '🛡️ Survivors won'}
                    </span>
                    {game.playerWon 
                      ? ` - You emerged victorious as a ${game.playerRole}!`
                      : ` - You fell victim as a ${game.playerRole}`
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function GameHistoryPageWrapper() {
  return (
    <AuthGuard fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="glass-card p-8 text-center animate-slide-up">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-granny-text text-lg mb-4">Please sign in to view your game history</p>
          <p className="text-granny-text-muted text-sm">Track your survival statistics and achievements</p>
        </div>
      </main>
    }>
      <GameHistoryPage />
    </AuthGuard>
  );
}