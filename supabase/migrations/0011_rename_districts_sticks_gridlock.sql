-- Rename two districts to sharper pun-forward names: The Stacks -> The Sticks,
-- The Grid -> Gridlock. Display-name only; slugs (the_stacks/the_grid) and all
-- gameplay fields (mechanic, durations, gaps) are unchanged so progress is preserved.
-- NOTE: level display_number 12 is also named 'Gridlock' (set in 0009); the new
-- district name intentionally shares that name per product request.
begin;

update public.themes set name = 'The Sticks' where slug = 'the_stacks';
update public.themes set name = 'Gridlock'   where slug = 'the_grid';

commit;
