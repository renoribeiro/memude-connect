-- Make data_visita_solicitada and horario_visita_solicitada columns nullable in the leads table
ALTER TABLE leads ALTER COLUMN data_visita_solicitada DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN horario_visita_solicitada DROP NOT NULL;
