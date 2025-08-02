-- Enable realtime for rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- Also enable for game_results if you want real-time game results
ALTER PUBLICATION supabase_realtime ADD TABLE game_results;