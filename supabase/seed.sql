-- supabase/seed.sql
-- Gap City districts (The Hollows 1-5, The Sticks 6-10, Gridlock 11-15).
-- Kept in sync with 0008_gap_city_districts.sql + 0009_gap_city_fictional_names.sql
-- + 0011_rename_districts_sticks_gridlock.sql.
insert into public.themes (slug,name,description,sort_order,piece_set,mechanic) values
 ('the_hollows','The Hollows','Sleepy outskirts — all gaps.',1,'{I,O,T,S,Z,J,L}','standard'),
 ('the_stacks','The Sticks','Blocks piling up.',2,'{I,O,T,S,Z,J,L}','standard'),
 ('the_grid','Gridlock','Dense downtown — locked in.',3,'{I,O,T,S,Z,J,L}','standard')
on conflict (slug) do nothing;

-- 15 levels across three districts from DIFFICULTY_TABLE.
with t as (select id, slug from public.themes)
insert into public.levels (theme_id,index_in_theme,display_number,view_duration_ms,select_duration_ms,gap_count,shape_complexity,adjacency,name)
values
 ((select id from t where slug='the_hollows'),1, 1, 4000,10000, 3,'simple',  0,'Vacant Heights'),
 ((select id from t where slug='the_hollows'),2, 2, 5000,11000, 4,'simple',  0,'Open Lots'),
 ((select id from t where slug='the_hollows'),3, 3, 6500,12000, 5,'simple',  0,'Holloway'),
 ((select id from t where slug='the_hollows'),4, 4, 8000,14000, 6,'medium',  1,'Gapstead'),
 ((select id from t where slug='the_hollows'),5, 5, 9000,15000, 7,'medium',  1,'Nilsen Park'),
 ((select id from t where slug='the_stacks'), 1, 6,10000,16000, 8,'medium',  1,'Brickfall'),
 ((select id from t where slug='the_stacks'), 2, 7,11000,17000, 9,'complex', 2,'Tetra Heights'),
 ((select id from t where slug='the_stacks'), 3, 8,12000,18000,10,'complex', 2,'Four Corners'),
 ((select id from t where slug='the_stacks'), 4, 9,13000,19000,11,'complex', 2,'Jaywick'),
 ((select id from t where slug='the_stacks'), 5,10,14000,20000,12,'complex', 2,'Snug Harbor'),
 ((select id from t where slug='the_grid'),1,11,15000,21000,13,'complex', 2,'Highrise Row'),
 ((select id from t where slug='the_grid'),2,12,16000,22000,14,'complex', 2,'Gridlock'),
 ((select id from t where slug='the_grid'),3,13,16500,22000,15,'complex', 2,'Tight Corners'),
 ((select id from t where slug='the_grid'),4,14,17000,23000,16,'complex', 2,'Clearway'),
 ((select id from t where slug='the_grid'),5,15,17000,23000,16,'complex', 2,'Perfect Square')
on conflict (theme_id,index_in_theme) do nothing;

insert into public.achievements (slug,name,description,criteria) values
 ('first_try_1','Sharpshooter','Clear a level on the first try','{"type":"first_try_clears","count":1}'),
 ('first_try_10','Eagle Eye','Clear 10 levels on the first try','{"type":"first_try_clears","count":10}')
on conflict (slug) do nothing;
