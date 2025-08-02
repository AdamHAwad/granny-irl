-- Drop existing room policies and create simpler ones
DROP POLICY IF EXISTS "Authenticated users can view rooms" ON rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON rooms;
DROP POLICY IF EXISTS "Room hosts and players can update rooms" ON rooms;
DROP POLICY IF EXISTS "Room hosts can delete rooms" ON rooms;

-- Create simpler policies for rooms
CREATE POLICY "Anyone authenticated can view rooms" ON rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can create rooms" ON rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can update rooms" ON rooms
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Room hosts can delete rooms" ON rooms
  FOR DELETE USING (auth.uid() = host_uid);