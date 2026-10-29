-- Events written in one transaction (a check and the status change it causes) all got the
-- transaction's start time from now(), so ordering them by time was arbitrary and a job's history
-- could show a check before the change it caused. clock_timestamp() is the time each row is
-- written, so the order is the order things happened.
alter table public.events alter column created_at set default clock_timestamp();
