-- Create prompts table for tracking what users generate
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_text text not null,
  created_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.prompts enable row level security;

-- Allow anyone to insert prompts (fire-and-forget tracking)
create policy "Anyone can insert prompts"
on public.prompts
for insert
to anon, authenticated
with check (true);

-- Create index for querying by date
create index prompts_created_at_idx on public.prompts(created_at desc);