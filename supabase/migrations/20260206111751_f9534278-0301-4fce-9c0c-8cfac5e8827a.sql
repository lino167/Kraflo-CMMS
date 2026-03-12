
-- Executar classificação retroativa para empresa a8e8ee94
DO $$
DECLARE
  v_result RECORD;
  v_count int := 0;
BEGIN
  FOR v_result IN SELECT * FROM classificar_os_retroativo('a8e8ee94-1594-4826-83d4-43d1b5d6a988'::uuid)
  LOOP
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'OSs classificadas: %', v_count;
END;
$$;
