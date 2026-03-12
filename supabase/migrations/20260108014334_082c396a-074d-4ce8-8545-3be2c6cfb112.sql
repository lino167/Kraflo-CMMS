-- Habilita extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove job existente se houver (para evitar duplicação)
SELECT cron.unschedule('process-os-index-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-os-index-queue'
);

-- Cria cron job para processar a fila de indexação a cada 5 minutos
SELECT cron.schedule(
  'process-os-index-queue',
  '*/5 * * * *', -- a cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://stqjixdsolguzpvjfrmr.supabase.co/functions/v1/process-os-index-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cWppeGRzb2xndXpwdmpmcm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODE4MDcsImV4cCI6MjA3Nzk1NzgwN30.70reUHiwdgM0_BpUM5DsGnKAS8suemAgPJLSnmgHGFY"}'::jsonb,
    body := '{"batch_size": 10, "concurrency": 1}'::jsonb
  ) AS request_id;
  $$
);