-- Persists the public "Book a demo" form (src/components/DemoDialog.tsx),
-- which previously validated client-side and then discarded the submission.
-- Field limits mirror that form's own existing maxLength attributes exactly
-- (name 100, email 255, phone 20, company 120, message 600) — no new
-- business rules invented here.
create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  email text not null check (char_length(email) <= 255 and email like '%@%.%'),
  phone text not null check (char_length(phone) <= 20),
  company text not null default '' check (char_length(company) <= 120),
  message text not null default '' check (char_length(message) <= 600),
  created_at timestamptz not null default now()
);
create index demo_requests_created_at_idx on public.demo_requests (created_at desc);

grant insert on public.demo_requests to anon, authenticated;
grant select on public.demo_requests to authenticated;
grant all on public.demo_requests to service_role;
alter table public.demo_requests enable row level security;

-- Public lead-capture form: anyone (signed in or not) may submit, nobody
-- but a super admin may read submissions back.
create policy "Anyone can submit a demo request"
  on public.demo_requests for insert to anon, authenticated
  with check (true);

create policy "Super admins can read demo requests"
  on public.demo_requests for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));
