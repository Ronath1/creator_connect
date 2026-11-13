-- Reviewed separately from portable SQL/RLS tests: pg_cron is a real hosted
-- extension. Job state/history survives application processes and deployments.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('creatorconnect-collaboration-tick','* * * * *','select marketplace_private.tick(100)');
-- Limit only this job's operational history; never purge product audit/evidence.
select cron.schedule('creatorconnect-collaboration-job-history','17 3 * * *',
 $$delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname in('creatorconnect-collaboration-tick','creatorconnect-collaboration-job-history')) and end_time<now()-interval '7 days'$$);
