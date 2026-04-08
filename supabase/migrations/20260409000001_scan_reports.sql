create table scan_reports (
  id uuid default gen_random_uuid() primary key,
  qr_code text not null,
  scanned_at timestamptz default now(),
  latitude float,
  longitude float,
  photo_url text,
  maps_link text
);
