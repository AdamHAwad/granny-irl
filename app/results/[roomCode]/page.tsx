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
        <div className="text-lg">Loading results...</div>
      </main>
    );
  }

  if (error || !gameResult) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Results Error</h1>
          <p className="text-red-600 mb-4">{error || 'Results not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to Home
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
    <main className="flex min-h-screen flex-col items-center justify-center p-4 max-w-2xl mx-auto">
      <div className="w-full bg-white rounded-lg shadow-lg p-6 text-black">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Game Results</h1>
          <div className={`text-6xl font-bold mb-4 ${
            gameResult.winners === 'killers' ? 'text-red-600' : 'text-blue-600'
          }`}>
            {gameResult.winners === 'killers' ? '💀 KILLERS WIN!' : '🏃 SURVIVORS WIN!'}
          </div>
          <p className="text-gray-600">
            Game Duration: {gameDurationMin}m {gameDurationSec}s
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-3 text-green-600">
              🏆 Winners ({winners.length})
            </h2>
            <div className="space-y-2">
              {winners.map((player) => (
                <PlayerCard key={player.uid} player={player} isWinner={true} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 text-red-600">
              💀 Eliminated ({losers.length})
            </h2>
            <div className="space-y-2">
              {gameResult.elimination_order.map((uid, index) => {
                const player = gameResult.final_players[uid];
                if (!player) return null;
                return (
                  <div key={uid} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <div className="text-red-600 font-bold text-sm w-8">
                      #{index + 1}
                    </div>
                    <PlayerCard player={player} isWinner={false} showElimination={true} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => router.push('/')}
            className="py-3 px-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            🏠 Home
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
    <div className={`flex items-center gap-3 p-3 rounded-lg ${
      isWinner ? 'bg-green-50' : showElimination ? 'bg-transparent' : 'bg-gray-50'
    }`}>
      {player.profilePictureUrl ? (
        <img
          src={player.profilePictureUrl}
          alt={player.displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-700">
            {player.displayName[0]?.toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1">
        <p className="font-medium">{player.displayName}</p>
        <p className={`text-xs ${
          player.role === 'killer' ? 'text-red-600' : 'text-blue-600'
        }`}>
          {player.role?.toUpperCase()}
        </p>
        {showElimination && player.eliminatedAt && (
          <p className="text-xs text-gray-500">
            Eliminated at {new Date(player.eliminatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
      {isWinner && <div className="text-2xl">🏆</div>}
      {!isWinner && !player.isAlive && <div className="text-red-500">💀</div>}
    </div>
  );
}

export default function ResultsPageWrapper({ params }: PageProps) {
  return (
    <AuthGuard fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <p>Please sign in to view results.</p>
      </main>
    }>
      <ResultsPage params={params} />
    </AuthGuard>
  );
}