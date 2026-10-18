-- CivicConnect schema. Run in the Supabase SQL editor or via `supabase db push`.
create type app_role as enum ('citizen','officer','supervisor','admin');
create type request_status as enum ('PENDING','IN_PROGRESS','RESOLVED');
create type request_priority as enum ('LOW','NORMAL','HIGH','URGENT');

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, description text,
  active boolean not null default true
);
create table request_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, active boolean not null default true,
  default_department_id uuid references departments(id)
);
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text check (char_length(phone) <= 20),
  role app_role not null default 'citizen',
  department_id uuid references departments(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create sequence request_ref_seq;
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique
    default 'CCR-' || extract(year from now())::int || '-' || lpad(nextval('request_ref_seq')::text, 6, '0'),
  citizen_id uuid not null default auth.uid() references profiles(id),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  category_id uuid not null references request_categories(id),
  location text not null check (char_length(location) between 2 and 200),
  landmark text check (char_length(landmark) <= 200),
  priority request_priority not null default 'NORMAL',
  status request_status not null default 'PENDING',
  department_id uuid references departments(id),
  assigned_officer_id uuid references profiles(id),
  image_path text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_summary text,
  archived boolean not null default false
);
create index on service_requests (citizen_id, submitted_at desc);
create index on service_requests (department_id, status);
create index on service_requests (assigned_officer_id);
create index on service_requests (submitted_at desc);

-- One table for status history, public updates, citizen messages and internal notes.
create table request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  actor_id uuid references profiles(id),
  kind text not null check (kind in ('submitted','status','assignment','public_update','citizen_message','internal_note')),
  from_status request_status, to_status request_status,
  body text check (char_length(body) <= 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index on request_events (request_id, created_at);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  request_id uuid references service_requests(id) on delete cascade,
  message text not null, read boolean not null default false,
  created_at timestamptz not null default now()
);
create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, entity text not null, entity_id uuid,
  details jsonb, created_at timestamptz not null default now()
);

-- Helpers
create function my_role() returns app_role language sql stable security definer set search_path=public
  as $$ select role from profiles where id = auth.uid() and active $$;
create function my_dept() returns uuid language sql stable security definer set search_path=public
  as $$ select department_id from profiles where id = auth.uid() and active $$;
create function is_staff() returns boolean language sql stable security definer set search_path=public
  as $$ select coalesce(my_role() in ('officer','supervisor','admin'), false) $$;

-- New auth users always become citizens; client metadata can never set a role.
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Citizen'), left(new.raw_user_meta_data->>'phone',20));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Row Level Security
alter table departments enable row level security;
alter table request_categories enable row level security;
alter table profiles enable row level security;
alter table service_requests enable row level security;
alter table request_events enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

create policy dept_read on departments for select to authenticated using (true);
create policy cat_read on request_categories for select using (true);
create policy cat_admin on request_categories for all to authenticated using (my_role()='admin') with check (my_role()='admin');
create policy dept_admin on departments for all to authenticated using (my_role()='admin') with check (my_role()='admin');

create policy prof_self on profiles for select to authenticated using (id = auth.uid() or is_staff());
create policy prof_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy prof_admin on profiles for update to authenticated using (my_role()='admin') with check (true);
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;   -- role/department/active change only via admin_set_user()

create policy req_select on service_requests for select to authenticated using (
  citizen_id = auth.uid() or my_role()='admin'
  or assigned_officer_id = auth.uid()
  or (is_staff() and department_id is not null and department_id = my_dept()));
create policy req_insert on service_requests for insert to authenticated
  with check (citizen_id = auth.uid() and status='PENDING' and priority='NORMAL'
              and department_id is null and assigned_officer_id is null and resolved_at is null);
revoke update, delete on service_requests from authenticated;  -- staff change data only through RPCs below

create policy ev_select on request_events for select to authenticated using (
  exists (select 1 from service_requests r where r.id = request_id) and (not is_internal or is_staff()));
create policy ev_citizen_msg on request_events for insert to authenticated with check (
  kind='citizen_message' and not is_internal and actor_id = auth.uid()
  and exists (select 1 from service_requests r where r.id = request_id and r.citizen_id = auth.uid()));
create policy notif_own on notifications for select to authenticated using (user_id = auth.uid());
create policy notif_mark on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated; grant update (read) on notifications to authenticated;
create policy audit_admin on audit_logs for select to authenticated using (my_role()='admin');

create function log_submission() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into request_events(request_id, actor_id, kind, to_status, body) values (new.id, new.citizen_id, 'submitted', 'PENDING', 'Request received');
  insert into notifications(user_id, request_id, message) values (new.citizen_id, new.id, 'Your request ' || new.reference_number || ' has been received.');
  insert into audit_logs(actor_id, action, entity, entity_id) values (new.citizen_id, 'request.create', 'service_request', new.id);
  return new;
end $$;
create trigger request_submitted after insert on service_requests for each row execute function log_submission();

-- Staff workflow RPCs (security definer, scope-checked)
create function can_manage(r service_requests) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(my_role()='admin' or r.assigned_officer_id = auth.uid()
    or (is_staff() and r.department_id is not null and r.department_id = my_dept()), false) $$;

create function update_request_status(p_id uuid, p_status request_status, p_public text default null, p_internal text default null)
returns void language plpgsql security definer set search_path=public as $$
declare r service_requests;
begin
  select * into r from service_requests where id = p_id for update;
  if not found or not can_manage(r) then raise exception 'Not authorized'; end if;
  if not ((r.status='PENDING' and p_status='IN_PROGRESS') or (r.status='IN_PROGRESS' and p_status='RESOLVED')
       or (r.status='RESOLVED' and p_status='IN_PROGRESS')) then raise exception 'Invalid status change'; end if;
  if p_status='RESOLVED' and coalesce(trim(p_public),'')='' then raise exception 'A resolution explanation is required'; end if;
  update service_requests set status=p_status, updated_at=now(),
    resolved_at = case when p_status='RESOLVED' then now() else null end,
    resolution_summary = case when p_status='RESOLVED' then p_public else resolution_summary end
  where id = p_id;
  insert into request_events(request_id, actor_id, kind, from_status, to_status, body) values (p_id, auth.uid(), 'status', r.status, p_status, nullif(trim(p_public),''));
  if nullif(trim(p_internal),'') is not null then
    insert into request_events(request_id, actor_id, kind, body, is_internal) values (p_id, auth.uid(), 'internal_note', p_internal, true);
  end if;
  insert into notifications(user_id, request_id, message) values (r.citizen_id, p_id, 'Request ' || r.reference_number || ' is now ' || replace(initcap(lower(p_status::text)),'_',' ') || '.');
  insert into audit_logs(actor_id, action, entity, entity_id, details) values (auth.uid(), 'request.status', 'service_request', p_id, jsonb_build_object('from', r.status, 'to', p_status));
end $$;

create function add_staff_note(p_id uuid, p_body text, p_internal boolean) returns void
language plpgsql security definer set search_path=public as $$
declare r service_requests;
begin
  select * into r from service_requests where id = p_id;
  if not found or not can_manage(r) or coalesce(trim(p_body),'')='' then raise exception 'Not authorized'; end if;
  insert into request_events(request_id, actor_id, kind, body, is_internal)
  values (p_id, auth.uid(), case when p_internal then 'internal_note' else 'public_update' end, p_body, p_internal);
  if not p_internal then
    update service_requests set updated_at = now() where id = p_id;
    insert into notifications(user_id, request_id, message) values (r.citizen_id, p_id, 'New update on request ' || r.reference_number || '.');
  end if;
end $$;

create function assign_request(p_id uuid, p_dept uuid, p_officer uuid default null, p_priority request_priority default null)
returns void language plpgsql security definer set search_path=public as $$
declare r service_requests; d departments;
begin
  select * into r from service_requests where id = p_id for update;
  if not found or my_role() not in ('supervisor','admin') or not can_manage(r) and r.department_id is not null then raise exception 'Not authorized'; end if;
  if my_role()='supervisor' and p_dept is distinct from my_dept() and r.department_id is distinct from my_dept() then raise exception 'Not authorized'; end if;
  select * into d from departments where id = p_dept and active;
  if not found then raise exception 'Department is inactive or missing'; end if;
  if p_officer is not null and not exists (select 1 from profiles where id = p_officer and active and role='officer' and department_id = p_dept) then
    raise exception 'Officer does not belong to that department'; end if;
  update service_requests set department_id = p_dept, assigned_officer_id = p_officer, priority = coalesce(p_priority, priority), updated_at = now() where id = p_id;
  insert into request_events(request_id, actor_id, kind, body) values (p_id, auth.uid(), 'assignment', 'Assigned to ' || d.name);
  insert into notifications(user_id, request_id, message) values (r.citizen_id, p_id, 'Request ' || r.reference_number || ' was assigned to ' || d.name || '.');
  insert into audit_logs(actor_id, action, entity, entity_id, details) values (auth.uid(), 'request.assign', 'service_request', p_id, jsonb_build_object('department', p_dept, 'officer', p_officer));
end $$;

create function admin_set_user(p_user uuid, p_role app_role, p_dept uuid, p_active boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if my_role() <> 'admin' then raise exception 'Not authorized'; end if;
  update profiles set role = p_role, department_id = p_dept, active = p_active where id = p_user;
  insert into audit_logs(actor_id, action, entity, entity_id, details) values (auth.uid(), 'user.update', 'profile', p_user, jsonb_build_object('role', p_role, 'dept', p_dept, 'active', p_active));
end $$;

-- Dashboard metrics. Runs with the caller's rights, so RLS limits the data scope.
-- "Open" = PENDING + IN_PROGRESS. Archived requests are excluded.
create function request_stats(p_days int default 30) returns json language sql stable security invoker as $$
  with r as (select * from service_requests where not archived and submitted_at >= now() - make_interval(days => p_days))
  select json_build_object(
    'total', count(*), 'pending', count(*) filter (where status='PENDING'),
    'in_progress', count(*) filter (where status='IN_PROGRESS'), 'resolved', count(*) filter (where status='RESOLVED'),
    'unassigned', count(*) filter (where department_id is null and status <> 'RESOLVED'),
    'avg_resolution_hours', round((avg(extract(epoch from resolved_at - submitted_at)/3600) filter (where status='RESOLVED' and resolved_at >= submitted_at))::numeric, 1),
    'by_category', (select coalesce(json_agg(json_build_object('name', c.name, 'count', x.n)), '[]'::json)
                    from (select category_id, count(*) n from r group by 1) x join request_categories c on c.id = x.category_id))
  from r $$;

revoke execute on function update_request_status, add_staff_note, assign_request, admin_set_user from public, anon;
grant execute on function update_request_status, add_staff_note, assign_request, admin_set_user to authenticated;

-- Private image bucket: JPEG/PNG/WebP, 5 MB, files stored under <user-id>/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-images', 'request-images', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy img_upload on storage.objects for insert to authenticated
  with check (bucket_id='request-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy img_read on storage.objects for select to authenticated
  using (bucket_id='request-images' and ((storage.foldername(name))[1] = auth.uid()::text or is_staff()));
