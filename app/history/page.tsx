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
        <div className="text-lg">Loading game history...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 max-w-4xl mx-auto">
      <div className="w-full bg-white rounded-lg shadow-lg p-6 text-black mb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Game History</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Home
          </button>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Your Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.gamesPlayed}</div>
                <div className="text-sm text-gray-600">Games Played</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
                <div className="text-sm text-gray-600">Wins</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{stats.losses}</div>
                <div className="text-sm text-gray-600">Losses</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.avgPlacement}</div>
                <div className="text-sm text-gray-600">Avg Placement</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.killerWins}</div>
                <div className="text-sm text-gray-600">Killer Wins</div>
              </div>
              <div className="bg-cyan-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-cyan-600">{stats.survivorWins}</div>
                <div className="text-sm text-gray-600">Survivor Wins</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.totalEliminations}</div>
                <div className="text-sm text-gray-600">Times Eliminated</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">Win Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Game History */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Games ({history.length})</h2>
          
          {history.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No games played yet!</p>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Play Your First Game
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((game, index) => (
                <div
                  key={`${game.room_id}-${game.game_ended_at}`}
                  className={`p-4 rounded-lg border-2 ${
                    game.playerWon 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        game.playerWon ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {game.playerWon ? 'WON' : 'LOST'}
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        game.playerRole === 'killer' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {game.playerRole.toUpperCase()}
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        Room: {game.room_id}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatDate(game.game_ended_at)} at {formatTime(game.game_ended_at)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {game.gameDurationMinutes} min • Placement: #{game.placement}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-700">
                    {game.winners === 'killers' ? 'Killers won' : 'Survivors won'}
                    {game.playerWon 
                      ? ` - You were victorious as a ${game.playerRole}!`
                      : ` - You were defeated as a ${game.playerRole}`
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
        <p>Please sign in to view your game history.</p>
      </main>
    }>
      <GameHistoryPage />
    </AuthGuard>
  );
}