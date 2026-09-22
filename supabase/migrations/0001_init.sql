-- =====================================================================
--  Regalos de Navidad · Ilustre Municipalidad de Coinco
--  Esquema inicial. Pegar completo en Supabase → SQL Editor → Run.
-- =====================================================================

-- ─────────────────────────── Campañas ────────────────────────────────
create table public.campanas (
  id                    uuid primary key default gen_random_uuid(),
  anio                  int  not null unique,
  nombre                text not null,
  decreto               text,                       -- N° de decreto que valida el Programa de Actividades Conmemorativas
  fecha_inicio          date not null,              -- primer día de inscripción
  fecha_fin             date not null,              -- último día de inscripción (inclusive)
  fecha_entrega         date,
  fecha_referencia_edad date not null,              -- fecha a la que se mide "hasta 4 años 11 meses 30 días"
  activa                boolean not null default false,
  created_at            timestamptz not null default now(),
  constraint campanas_fechas_ok check (fecha_fin >= fecha_inicio)
);
-- A lo más una campaña activa a la vez
create unique index campanas_una_activa on public.campanas ((1)) where activa;

-- ─────────────────────────── Sectores ────────────────────────────────
create table public.sectores (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  orden  int not null default 0
);

-- ─────────────────────── Perfiles de funcionarios ────────────────────
create table public.perfiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  email      text,
  rol        text not null check (rol in ('admin','revisor','digitador')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.rol_actual()
returns text
language sql stable security definer set search_path = public
as $$ select rol from public.perfiles where user_id = auth.uid() and activo $$;

create or replace function public.es_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.perfiles where user_id = auth.uid() and activo) $$;

-- ─────────────────────────── Inscripciones ───────────────────────────
-- Una inscripción = un formulario (un apoderado, uno o más beneficiarios).
create table public.inscripciones (
  id                        uuid primary key default gen_random_uuid(),
  folio                     text not null unique,
  campana_id                uuid not null references public.campanas(id),
  canal                     text not null check (canal in ('online','presencial')),
  estado                    text not null default 'recibida'
                              check (estado in ('recibida','en_revision','observada','aprobada','rechazada')),

  apoderado_rut             text not null,
  apoderado_nombres         text not null,
  apoderado_apellidos       text not null,
  apoderado_telefono        text not null,
  apoderado_email           text,
  direccion                 text not null,
  sector_id                 uuid references public.sectores(id),

  residencia_acreditada_con text not null check (residencia_acreditada_con in ('rsh','certificado_jv')),
  tramo_declarado           text not null check (tramo_declarado in ('hasta_40','no_sabe')),

  observacion               text,                    -- mensaje que ve el apoderado (observada / rechazada)
  checklist                 jsonb not null default '{}'::jsonb,
  revisado_por              uuid references auth.users(id),
  revisado_at               timestamptz,
  creado_por                uuid references auth.users(id),   -- funcionario que registró (presencial)
  acepta_datos              boolean not null default false,
  acepta_datos_at           timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index inscripciones_campana_estado on public.inscripciones (campana_id, estado);
create index inscripciones_apoderado_rut  on public.inscripciones (apoderado_rut);
create index inscripciones_created_at     on public.inscripciones (created_at desc);

-- ─────────────────────────── Beneficiarios ───────────────────────────
create table public.beneficiarios (
  id                  uuid primary key default gen_random_uuid(),
  inscripcion_id      uuid not null references public.inscripciones(id) on delete cascade,
  campana_id          uuid not null references public.campanas(id),
  tipo                text not null check (tipo in ('nino','gestante')),
  rut                 text not null,
  nombres             text not null,
  apellidos           text not null,
  fecha_nacimiento    date,
  sexo                text check (sexo in ('F','M','otro')),
  documento_identidad text check (documento_identidad in ('cedula','certificado_nacimiento')),
  fecha_probable_parto date,
  activo              boolean not null default true,   -- false cuando la inscripción fue rechazada
  entregado_at        timestamptz,
  entregado_por       uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  constraint beneficiarios_nino_ok
    check (tipo = 'gestante' or (fecha_nacimiento is not null and sexo is not null and documento_identidad is not null))
);
-- Un mismo RUT no puede estar dos veces (activo) en la misma campaña
create unique index beneficiarios_rut_campana on public.beneficiarios (campana_id, rut) where activo;
create index beneficiarios_inscripcion on public.beneficiarios (inscripcion_id);

-- ──────────────────────────── Documentos ─────────────────────────────
create table public.documentos (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  beneficiario_id uuid references public.beneficiarios(id) on delete cascade,  -- null = documento del hogar
  tipo            text not null check (tipo in (
                    'cedula','certificado_nacimiento','carnet_control_sano',
                    'carnet_control_embarazo','cartola_rsh','certificado_residencia')),
  storage_path    text not null unique,
  nombre_original text,
  mime            text,
  tamano          int,
  origen          text not null default 'apoderado' check (origen in ('apoderado','funcionario')),
  created_at      timestamptz not null default now()
);
create index documentos_inscripcion on public.documentos (inscripcion_id);

-- ─────────────────────── Historial de estados ────────────────────────
create table public.historial_estados (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  estado_anterior text,
  estado_nuevo    text not null,
  comentario      text,
  usuario_id      uuid references auth.users(id),
  usuario_nombre  text,           -- 'Apoderado' / 'Sistema' / nombre del funcionario
  created_at      timestamptz not null default now()
);
create index historial_inscripcion on public.historial_estados (inscripcion_id, created_at);

-- ───────────────────────────── Correos ───────────────────────────────
create table public.correos_log (
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid references public.inscripciones(id) on delete set null,
  campana_id     uuid references public.campanas(id) on delete set null,
  tipo           text not null check (tipo in ('comprobante','observada','aprobada','rechazada','aviso_entrega')),
  destinatario   text not null,
  asunto         text not null,
  cuerpo_html    text not null,
  estado         text not null default 'pendiente' check (estado in ('pendiente','enviado','error')),
  intentos       int not null default 0,
  ultimo_error   text,
  created_at     timestamptz not null default now(),
  enviado_at     timestamptz
);
create index correos_estado on public.correos_log (estado, created_at);

-- ─────────────────────── Limitador de velocidad ──────────────────────
create table public.rate_limit (
  clave         text primary key,
  hits          int not null,
  ventana_inicio timestamptz not null
);

create or replace function public.rate_limit_hit(p_clave text, p_max int, p_ventana_seg int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_hits int;
begin
  insert into public.rate_limit (clave, hits, ventana_inicio)
  values (p_clave, 1, now())
  on conflict (clave) do update set
    hits = case when public.rate_limit.ventana_inicio < now() - make_interval(secs => p_ventana_seg)
                then 1 else public.rate_limit.hits + 1 end,
    ventana_inicio = case when public.rate_limit.ventana_inicio < now() - make_interval(secs => p_ventana_seg)
                then now() else public.rate_limit.ventana_inicio end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;

-- ────────────────────────────── Triggers ─────────────────────────────
-- Al rechazar una inscripción, sus beneficiarios dejan de bloquear el RUT (pueden reinscribirse).
create or replace function public.trg_inscripcion_estado()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'rechazada' and old.estado <> 'rechazada' then
    update public.beneficiarios set activo = false where inscripcion_id = new.id;
  elsif old.estado = 'rechazada' and new.estado <> 'rechazada' then
    update public.beneficiarios set activo = true where inscripcion_id = new.id;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger inscripciones_estado_biu
before update on public.inscripciones
for each row execute function public.trg_inscripcion_estado();

-- ───────────────────── Seguridad a nivel de fila (RLS) ───────────────
-- Modelo: el público NO accede a la base de datos directamente. Todo el
-- acceso público pasa por el servidor de Next.js (service role) tras validar.
-- Las políticas de abajo son una segunda barrera: aunque se filtrara la
-- clave anónima, no se puede leer nada; y los funcionarios autenticados
-- solo pueden LEER (las escrituras las hace el servidor).
alter table public.campanas          enable row level security;
alter table public.sectores          enable row level security;
alter table public.perfiles          enable row level security;
alter table public.inscripciones     enable row level security;
alter table public.beneficiarios     enable row level security;
alter table public.documentos        enable row level security;
alter table public.historial_estados enable row level security;
alter table public.correos_log       enable row level security;
alter table public.rate_limit        enable row level security;

create policy campanas_staff_select    on public.campanas          for select to authenticated using (public.es_staff());
create policy sectores_staff_select    on public.sectores          for select to authenticated using (public.es_staff());
create policy inscrip_staff_select     on public.inscripciones     for select to authenticated using (public.es_staff());
create policy benef_staff_select       on public.beneficiarios     for select to authenticated using (public.es_staff());
create policy docs_staff_select        on public.documentos        for select to authenticated using (public.es_staff());
create policy hist_staff_select        on public.historial_estados for select to authenticated using (public.es_staff());
create policy correos_admin_select     on public.correos_log       for select to authenticated using (public.rol_actual() = 'admin');
create policy perfiles_own_select      on public.perfiles          for select to authenticated using (user_id = auth.uid() or public.rol_actual() = 'admin');

revoke all on public.campanas, public.sectores, public.perfiles, public.inscripciones,
              public.beneficiarios, public.documentos, public.historial_estados,
              public.correos_log, public.rate_limit from anon;

-- ─────────────────────────── Storage privado ─────────────────────────
-- Bucket privado. Los archivos se suben con URL firmada emitida por el servidor
-- y se leen solo con URL firmada temporal (panel de funcionarios).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 6291456,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
