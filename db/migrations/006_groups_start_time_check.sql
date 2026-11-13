-- TIME aceita '24:00:00'; a agenda e o fmtHora só tratam 00:00–23:59.
ALTER TABLE groups
  ADD CONSTRAINT groups_start_time_check CHECK (start_time < '24:00');
