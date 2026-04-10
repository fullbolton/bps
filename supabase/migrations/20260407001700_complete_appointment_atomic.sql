-- ==========================================================================
-- BPS Mutation Integrity — Appointment completion + task handoff atomicity
-- Single RPC: update appointment status + optionally create linked task.
-- Idempotency: if appointment is already tamamlandi, returns existing
-- state without creating a duplicate task.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.complete_appointment_atomic(
  p_appointment_id uuid,
  p_result text,
  p_next_action text,
  p_create_task boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_appointment appointments%ROWTYPE;
  v_task_id uuid := NULL;
  v_existing_task_id uuid;
BEGIN
  v_user_id := auth.uid();

  -- Lock the appointment row for update
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Appointment % not found', p_appointment_id;
  END IF;

  -- Idempotency: already completed — return existing state
  IF v_appointment.status = 'tamamlandi' THEN
    -- Check if task already exists for this handoff
    SELECT id INTO v_existing_task_id
    FROM tasks
    WHERE appointment_id = p_appointment_id
      AND source_type = 'randevu'
    LIMIT 1;

    RETURN jsonb_build_object(
      'appointment_id', p_appointment_id,
      'task_id', v_existing_task_id,
      'idempotent', true
    );
  END IF;

  -- Update appointment
  UPDATE appointments SET
    status = 'tamamlandi',
    result = p_result,
    next_action = p_next_action,
    updated_at = now()
  WHERE id = p_appointment_id;

  -- Optionally create linked task
  IF p_create_task THEN
    INSERT INTO tasks (
      company_id, title, source_type, appointment_id,
      status, created_by
    ) VALUES (
      v_appointment.company_id,
      p_next_action,
      'randevu',
      p_appointment_id,
      'acik',
      v_user_id
    )
    RETURNING id INTO v_task_id;
  END IF;

  RETURN jsonb_build_object(
    'appointment_id', p_appointment_id,
    'task_id', v_task_id,
    'idempotent', false
  );
END;
$$;
