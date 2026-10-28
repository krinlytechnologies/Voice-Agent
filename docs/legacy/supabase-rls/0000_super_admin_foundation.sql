create type public.app_role as enum ('super_admin', 'client_admin', 'client_user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can read their own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "Super admins can read all roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Super admins can read all profiles"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  credit_balance integer not null default 0 check (credit_balance >= 0),
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_email text not null default '',
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);
grant select, insert on public.client_members to authenticated;
grant all on public.client_members to service_role;
alter table public.client_members enable row level security;

create policy "Super admins can manage clients"
  on public.clients for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their own client"
  on public.clients for select to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = clients.id and m.user_id = auth.uid()
  ));

create policy "Super admins can manage client members"
  on public.client_members for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client team"
  on public.client_members for select to authenticated
  using (exists (
    select 1 from public.client_members mine
    where mine.client_id = client_members.client_id and mine.user_id = auth.uid()
  ));

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  amount integer not null,
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert on public.credit_transactions to authenticated;
grant all on public.credit_transactions to service_role;
alter table public.credit_transactions enable row level security;

create policy "Super admins can manage credit transactions"
  on public.credit_transactions for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client transactions"
  on public.credit_transactions for select to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = credit_transactions.client_id and m.user_id = auth.uid()
  ));

create or replace function public.apply_credit_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
    set credit_balance = credit_balance + new.amount
    where id = new.client_id;
  if (select credit_balance from public.clients where id = new.client_id) < 0 then
    raise exception 'Insufficient credits for this adjustment';
  end if;
  return new;
end
$$;

create trigger on_credit_transaction
  after insert on public.credit_transactions
  for each row execute function public.apply_credit_transaction();

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  outcome text not null default 'completed',
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert on public.calls to authenticated;
grant all on public.calls to service_role;
alter table public.calls enable row level security;

create policy "Super admins can manage calls"
  on public.calls for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client calls"
  on public.calls for select to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = calls.client_id and m.user_id = auth.uid()
  ));