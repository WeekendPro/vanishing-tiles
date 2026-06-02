-- Gap City Spec 2: rename NYC toponyms to fictional pun-forward neighborhoods.
-- Rename-only. No schema or RPC changes.
-- themes.mechanic is a GAMEPLAY field ('standard') surfaced by get_journey — do NOT touch it.
-- Flavor text goes in themes.description (DB-only; get_journey does not expose it today).
begin;

update public.themes set slug = 'the_hollows', name = 'The Hollows', description = 'Sleepy outskirts — all gaps.' where slug = 'the_bronx';
update public.themes set slug = 'the_stacks',  name = 'The Stacks',  description = 'Blocks piling up.'             where slug = 'brooklyn';
update public.themes set slug = 'the_grid',    name = 'The Grid',    description = 'Dense downtown — locked in.'    where slug = 'manhattan';

update public.levels set name = 'Vacant Heights' where display_number = 1;
update public.levels set name = 'Open Lots'      where display_number = 2;
update public.levels set name = 'Holloway'       where display_number = 3;
update public.levels set name = 'Gapstead'       where display_number = 4;
update public.levels set name = 'Nilsen Park'    where display_number = 5;
update public.levels set name = 'Brickfall'      where display_number = 6;
update public.levels set name = 'Tetra Heights'  where display_number = 7;
update public.levels set name = 'Four Corners'   where display_number = 8;
update public.levels set name = 'Jaywick'        where display_number = 9;
update public.levels set name = 'Snug Harbor'    where display_number = 10;
update public.levels set name = 'Highrise Row'   where display_number = 11;
update public.levels set name = 'Gridlock'       where display_number = 12;
update public.levels set name = 'Tight Corners'  where display_number = 13;
update public.levels set name = 'Clearway'       where display_number = 14;
update public.levels set name = 'Perfect Square' where display_number = 15;

commit;
