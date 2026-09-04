-- Adds a short, sequential request number for humans.
--
-- The primary key stays the UUID; this is purely the handle Emily and
-- volunteers use out loud ("request 1042"). Starts at 1001 so the
-- numbers never look like a running count of how few requests exist.
--
-- Safe to re-run.

alter table requests add column if not exists request_number integer;

create sequence if not exists requests_request_number_seq
  as integer start with 1001 owned by requests.request_number;

-- Backfill any pre-existing rows in the order they came in, so the
-- numbering matches the order Emily reviewed them.
update requests r
set request_number = sub.rn
from (
  select id, 1000 + row_number() over (order by created_at, id) as rn
  from requests
  where request_number is null
) sub
where r.id = sub.id
  and r.request_number is null;

-- Move the sequence past whatever the backfill used.
select setval(
  'requests_request_number_seq',
  greatest(coalesce((select max(request_number) from requests), 1000), 1000)
);

alter table requests
  alter column request_number set default nextval('requests_request_number_seq');

alter table requests alter column request_number set not null;

create unique index if not exists requests_request_number_key
  on requests(request_number);
