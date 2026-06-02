-- supabase/seed.sql
-- Gap City districts (The Bronx 1-5, Brooklyn 6-10, Manhattan 11-15).
-- Kept in sync with 0008_gap_city_districts.sql.
insert into public.themes (slug,name,description,sort_order,unlock_threshold,piece_set,mechanic) values
 ('the_bronx','The Bronx','Where the run begins',1,0.0,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('brooklyn','Brooklyn','Picking up speed',2,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard'),
 ('manhattan','Manhattan','The big leagues',3,0.7,'{I,O,T,S,Z,J,L,SINGLE}','standard')
on conflict (slug) do nothing;

-- 15 levels across three districts from DIFFICULTY_TABLE.
with t as (select id, slug from public.themes)
insert into public.levels (theme_id,index_in_theme,display_number,view_duration_ms,select_duration_ms,gap_count,shape_complexity,adjacency,name)
values
 ((select id from t where slug='the_bronx'),1, 1, 4000,10000, 3,'simple',  0,'Castle Hill'),
 ((select id from t where slug='the_bronx'),2, 2, 5000,11000, 4,'simple',  0,'East Tremont'),
 ((select id from t where slug='the_bronx'),3, 3, 6500,12000, 5,'simple',  0,'Hunts Point'),
 ((select id from t where slug='the_bronx'),4, 4, 8000,14000, 6,'medium',  1,'Melrose'),
 ((select id from t where slug='the_bronx'),5, 5, 9000,15000, 7,'medium',  1,'City Island'),
 ((select id from t where slug='brooklyn'), 1, 6,10000,16000, 8,'medium',  1,'Bed-Stuy'),
 ((select id from t where slug='brooklyn'), 2, 7,11000,17000, 9,'complex', 2,'Canarsie'),
 ((select id from t where slug='brooklyn'), 3, 8,12000,18000,10,'complex', 2,'Bushwick'),
 ((select id from t where slug='brooklyn'), 4, 9,13000,19000,11,'complex', 2,'Flatbush'),
 ((select id from t where slug='brooklyn'), 5,10,14000,20000,12,'complex', 2,'Red Hook'),
 ((select id from t where slug='manhattan'),1,11,15000,21000,13,'complex', 2,'Harlem'),
 ((select id from t where slug='manhattan'),2,12,16000,22000,14,'complex', 2,'Chelsea'),
 ((select id from t where slug='manhattan'),3,13,16500,22000,15,'complex', 2,'SoHo'),
 ((select id from t where slug='manhattan'),4,14,17000,23000,16,'complex', 2,'Washington Heights'),
 ((select id from t where slug='manhattan'),5,15,17000,23000,16,'complex', 2,'Tribeca')
on conflict (theme_id,index_in_theme) do nothing;

insert into public.achievements (slug,name,description,criteria) values
 ('first_try_1','Sharpshooter','Clear a level on the first try','{"type":"first_try_clears","count":1}'),
 ('first_try_10','Eagle Eye','Clear 10 levels on the first try','{"type":"first_try_clears","count":10}')
on conflict (slug) do nothing;
