-- Run once in the Supabase SQL editor. Repeatable; creates private production
-- and test tables. Only the service role can access reports and screenshots.
DO $migration$
DECLARE prefix text;
BEGIN
  FOREACH prefix IN ARRAY ARRAY['', 'test_'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (
      id uuid PRIMARY KEY,
      net_id text NOT NULL,
      full_name text NOT NULL,
      category text NOT NULL,
      subject text NOT NULL,
      description text NOT NULL,
      attachments jsonb NOT NULL DEFAULT ''[]''::jsonb,
      status text NOT NULL DEFAULT ''open'' CHECK (status IN (''open'', ''resolved'')),
      notification_status text NOT NULL DEFAULT ''pending'' CHECK (notification_status IN (''pending'', ''sending'', ''sent'')),
      notification_attempted_at timestamptz,
      notified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )', prefix || 'support_tickets');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (created_at DESC)', prefix || 'support_tickets_created_idx', prefix || 'support_tickets');
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', prefix || 'support_tickets');
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', prefix || 'support_tickets');
    EXECUTE format('GRANT ALL ON public.%I TO service_role', prefix || 'support_tickets');
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (key text PRIMARY KEY, starts_at timestamptz NOT NULL DEFAULT now(), count integer NOT NULL DEFAULT 1)', prefix || 'support_rate_buckets');
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', prefix || 'support_rate_buckets');
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', prefix || 'support_rate_buckets');
    EXECUTE format('GRANT ALL ON public.%I TO service_role', prefix || 'support_rate_buckets');
    EXECUTE format($function$
      CREATE OR REPLACE FUNCTION public.%I(bucket_key text, max_requests integer)
      RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $body$
      DECLARE used integer;
      BEGIN
        DELETE FROM public.%I WHERE starts_at < now() - interval '2 hours';
        INSERT INTO public.%I AS bucket (key) VALUES (bucket_key)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN bucket.starts_at < now() - interval '1 hour' THEN 1 ELSE bucket.count + 1 END,
          starts_at = CASE WHEN bucket.starts_at < now() - interval '1 hour' THEN now() ELSE bucket.starts_at END
        RETURNING count INTO used;
        RETURN used <= max_requests;
      END; $body$
    $function$, prefix || 'support_rate_limit', prefix || 'support_rate_buckets', prefix || 'support_rate_buckets');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(text, integer) FROM PUBLIC, anon, authenticated', prefix || 'support_rate_limit');
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(text, integer) TO service_role', prefix || 'support_rate_limit');
  END LOOP;
END; $migration$;
NOTIFY pgrst, 'reload schema';
