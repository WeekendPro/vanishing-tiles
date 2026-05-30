-- supabase/seed.sql
insert into public.themes (slug,name,description,sort_order,unlock_threshold,piece_set,mechanic) values
 ('beginner','Beginner','Learn the ropes',1,0.0,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('intermediate','Intermediate','Picking up speed',2,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('advanced','Advanced','Trickier pieces only',3,0.7,'{T,S,Z,J,L}','advanced'),
 ('numbered','Numbered','Fill in order',4,0.7,'{I,O,T,S,Z,J,L,SINGLE}','numbered'),
 ('flashmob','Flash Mob','One piece at a time',5,0.7,'{I,O,T,S,Z,J,L,SINGLE}','flashmob')
on conflict (slug) do nothing;

-- Beginner (1-7) and Intermediate (8-15) from DIFFICULTY_TABLE.
with t as (select id, slug from public.themes)
insert into public.levels (theme_id,index_in_theme,display_number,view_duration_ms,select_duration_ms,gap_count,shape_complexity,adjacency)
values
 ((select id from t where slug='beginner'),1,1,10000,15000,3,'simple',0),
 ((select id from t where slug='beginner'),2,2,9000,15000,4,'simple',0),
 ((select id from t where slug='beginner'),3,3,8100,14000,5,'simple',0),
 ((select id from t where slug='beginner'),4,4,9300,14000,6,'medium',1),
 ((select id from t where slug='beginner'),5,5,8600,13000,7,'medium',1),
 ((select id from t where slug='beginner'),6,6,8000,13000,8,'medium',1),
 ((select id from t where slug='beginner'),7,7,9500,12000,9,'complex',2),
 ((select id from t where slug='intermediate'),1,8,9000,12000,10,'complex',2),
 ((select id from t where slug='intermediate'),2,9,8500,11000,11,'complex',2),
 ((select id from t where slug='intermediate'),3,10,8100,11000,12,'complex',2),
 ((select id from t where slug='intermediate'),4,11,7700,10000,13,'complex',2),
 ((select id from t where slug='intermediate'),5,12,7300,10000,14,'complex',2),
 ((select id from t where slug='intermediate'),6,13,7000,9000,15,'complex',2),
 ((select id from t where slug='intermediate'),7,14,6700,9000,16,'complex',2),
 ((select id from t where slug='intermediate'),8,15,6500,9000,16,'complex',2)
on conflict (theme_id,index_in_theme) do nothing;

insert into public.achievements (slug,name,description,criteria) values
 ('first_try_1','Sharpshooter','Clear a level on the first try','{"type":"first_try_clears","count":1}'),
 ('first_try_10','Eagle Eye','Clear 10 levels on the first try','{"type":"first_try_clears","count":10}')
on conflict (slug) do nothing;
