-- supabase/migrations/0001b_profile_trigger.sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, is_guest, display_name)
  values (new.id, coalesce((new.raw_user_meta_data->>'is_guest')::boolean, new.email is null),
          coalesce(new.raw_user_meta_data->>'display_name', 'Player'))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
