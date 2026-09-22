#!/usr/bin/env node
/**
 * Crea (o promueve) el primer administrador del panel.
 *
 * Uso:
 *   node --env-file=.env.local scripts/crear-admin.mjs correo@municoinco.cl "Contraseña-larga-123" "Nombre Apellido"
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 */
import { createClient } from "@supabase/supabase-js";

const [email, password, nombre] = process.argv.slice(2);
if (!email || !password || !nombre) {
  console.error('Uso: node --env-file=.env.local scripts/crear-admin.mjs <correo> <contraseña> "<Nombre completo>"');
  process.exit(1);
}
if (password.length < 10) {
  console.error("La contraseña debe tener al menos 10 caracteres.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
const { data: creado, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  if (!/already|registered|exists/i.test(error.message)) {
    console.error("No se pudo crear el usuario:", error.message);
    process.exit(1);
  }
  // Ya existe: buscarlo y promoverlo
  const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 });
  userId = lista?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) {
    console.error("El usuario existe pero no se pudo encontrar.");
    process.exit(1);
  }
  console.log("El usuario ya existía en Supabase Auth; se le asigna el perfil de administrador.");
} else {
  userId = creado.user.id;
}

const { error: errPerfil } = await db
  .from("perfiles")
  .upsert({ user_id: userId, nombre, email, rol: "admin", activo: true }, { onConflict: "user_id" });
if (errPerfil) {
  console.error("No se pudo crear el perfil:", errPerfil.message);
  process.exit(1);
}
console.log(`Listo. ${email} ya puede ingresar en /admin/login como administrador.`);
