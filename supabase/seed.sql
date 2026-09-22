-- =====================================================================
--  Datos iniciales. Ejecutar después de 0001_init.sql.
--  AJUSTAR las fechas y el N° de decreto según el acto administrativo vigente.
-- =====================================================================
insert into public.campanas (anio, nombre, decreto, fecha_inicio, fecha_fin, fecha_entrega, fecha_referencia_edad, activa)
values (2026, 'Regalos de Navidad 2026', null, '2026-08-01', '2026-10-31', '2026-12-15', '2026-12-15', true)
on conflict (anio) do nothing;

-- Sectores / Juntas de Vecinos: reemplazar por el listado real de la comuna
-- (también se pueden administrar desde el panel: Administración → Sectores).
insert into public.sectores (nombre, orden) values
  ('Coinco (centro)', 1),
  ('Otro sector', 99)
on conflict (nombre) do nothing;
