-- The browser only touches profiles once signed in and the leaderboard is served with the secret key, so the publishable key
-- alone no longer reads every row and cloud save. Signed-in players keep their access until cloud saves move to their own table.
revoke all on public.profiles from anon;

-- No policy allows these for signed-in players either, the grants only widened what a future policy would open.
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;
