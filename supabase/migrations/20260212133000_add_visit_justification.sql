-- Add justification and rescheduling fields to visits
ALTER TABLE visits ADD COLUMN justification TEXT;
ALTER TABLE visits ADD COLUMN rescheduled_date DATE;
ALTER TABLE visits ADD COLUMN rescheduled_time TIME;

-- Add a comment to describe the new columns
COMMENT ON COLUMN visits.justification IS 'Justificación obligatoria para visitas atrasadas';
COMMENT ON COLUMN visits.rescheduled_date IS 'Nueva fecha programada tras atraso o rechazo';
COMMENT ON COLUMN visits.rescheduled_time IS 'Nueva hora programada tras atraso o rechazo';
