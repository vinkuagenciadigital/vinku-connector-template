// ============================================================================
// PARA QUÉ SIRVE:
//   Es el endpoint que usa el botón "CREAR PROYECTO CLIENTE" de la Fábrica.
//   Cuando creas un cliente nuevo desde la pantalla de Admin, esta ruta hace
//   todo el trabajo pesado:
//
//   1. Recibe nombre, slug y keys del cliente desde el formulario.
//   2. Limpia y normaliza el slug y corrige el typo "siig" -> "siigo".
//   3. Crea un proyecto nuevo en Vercel conectado al repo plantilla del conector.
//   4. Corrige el dominio para que quede con "siigo" y no con "siig".
//   5. Guarda las variables de entorno del cliente (CLIENTIFY_API_KEY, CLIENTE_NOMBRE)
//      en ese proyecto nuevo de Vercel.
//   6. Lanza el primer deploy en producción.
//   7. Crea los campos personalizados en la cuenta de Clientify DEL CLIENTE
//      usando lib/clientify-fields-v2.ts (9 en Deal, 2 en Contacto, 2 en Empresa).
//   8. Devuelve a la pantalla la URL del proyecto, el webhook y el resultado de los campos.
//
// CÓMO SE USA:
//   La pantalla app/admin/page.tsx lo llama con:
//   fetch('/api/admin/crear-proyecto', { method: 'POST', body: JSON.stringify(form) })
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { ensureCustomFieldsV2 } from '@/lib/clientify-fields-v2'

export async function POST(req: NextRequest) {
  try {
    // Recibimos los datos que el usuario escribió en el formulario de la Fábrica
    // nombreCliente: nombre bonito para mostrar, slug: nombre para la URL, y las keys del cliente
    // --- NUEVO: erpProvider y campos Odoo vienen del selector que agregamos en la Fábrica ---
    const { nombreCliente, slug, clientifyApiKey, siigoUser, siigoAccessKey, erpProvider, odooUrl, odooDb, odooUser, odooApiKey } = await req.json()

    // Si no viene slug no podemos crear el proyecto, frenamos aquí
    if (!slug) return NextResponse.json({ error: 'Falta slug' }, { status: 400 })

    // Variables de entorno de la Fábrica, configuradas en Vercel
    // VERCEL_TOKEN: permiso para crear proyectos vía API de Vercel
    // TEMPLATE_GITHUB_REPO: repo plantilla del conector, ej: usuario/vinku-connector-template
    // TEAM_ID: equipo de Vercel, si está vacío usa la cuenta personal
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
    const TEMPLATE_REPO = process.env.TEMPLATE_GITHUB_REPO!
    const TEAM_ID = process.env.VERCEL_TEAM_ID || ''
    
    // --- NUEVO: Define qué ERP está construyendo la fábrica ---
    const provider = (erpProvider || 'siigo').toLowerCase() // siigo | odoo
    const esOdoo = provider === 'odoo'
    const sufijoERP = esOdoo ? 'conexion-clientify-odoo' : 'conexion-clientify-siigo'

    // 1. Normaliza el slug para que sea una URL válida
    // Lo pasa a minúsculas, quita caracteres raros, deja solo letras, números y guiones
    // También quita guiones dobles y guiones al inicio o al final
    let baseSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '')

    // 2. FIX SIIGO: Corrige si viene sin la o y evita duplicar el sufijo
    // Si el usuario escribió "siig" por error, lo corrige a "siigo"
    baseSlug = baseSlug.replace(/siig$/i, 'siigo') // si termina en siig -> siigo
    baseSlug = baseSlug.replace(/conexion-clientify-siig$/i, 'conexion-clientify-siigo')

    // Si el slug todavía no tiene el sufijo completo, se lo agrega
    // Ej: "acme" -> "acme-conexion-clientify-siigo" o "acme-conexion-clientify-odoo"
    let cleanSlug = baseSlug
    if (!cleanSlug.includes('conexion-clientify-siigo') && !cleanSlug.includes('conexion-clientify-odoo')) {
      cleanSlug = `${cleanSlug}-${sufijoERP}`
    }
    // Garantía final: si por cualquier cosa aún termina en siig, lo corrige (solo para Siigo)
    if (!esOdoo) {
      cleanSlug = cleanSlug.replace(/-siig$/i, '-siigo')
    }
    // Vercel permite máximo 100 caracteres en el nombre, lo recortamos a 96 para dejar margen
    cleanSlug = cleanSlug.slice(0, 96) // Vercel max 100, dejamos margen

    // Prepara los parámetros de equipo para las llamadas a la API de Vercel
    // teamQuery: para la mayoría de llamadas
    // teamQueryDeploy: para el deploy, con forceNew=1 para forzar un deploy nuevo
    const teamQuery = TEAM_ID ? `?teamId=${TEAM_ID}` : ''
    const teamQueryDeploy = TEAM_ID ? `?forceNew=1&teamId=${TEAM_ID}` : '?forceNew=1'

    // 3. Crea el proyecto en Vercel conectado al repo plantilla de GitHub
    // Esto es lo que hace que aparezca un proyecto nuevo en tu dashboard de Vercel
    const resProject = await fetch(`https://api.vercel.com/v10/projects${teamQuery}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanSlug,
        gitRepository: { type: 'github', repo: TEMPLATE_REPO },
        framework: 'nextjs',
      }),
    })
    let projectData = await resProject.json()
    // Si Vercel responde con error, frenamos y mostramos el error
    if (!resProject.ok) throw new Error(JSON.stringify(projectData))

    // --- INICIO FIX DOMINIO SIIGO (agregado) ---
    // Vercel a veces crea el dominio con el typo "siig", aquí lo corregimos
    const dominioBueno = `${cleanSlug}.vercel.app`
    const dominioMalo = `${cleanSlug.replace(/siigo$/i, 'siig')}.vercel.app`
    
    // Asegura que el dominio bueno exista
    // El .catch(()=>{}) es para que no frene todo si ya existe
    await fetch(`https://api.vercel.com/v9/projects/${projectData.id}/domains${teamQuery}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: dominioBueno }),
    }).catch(()=>{})

    // Borra el dominio malo si Vercel lo creó
    // Así el cliente solo queda con la URL correcta terminada en siigo
    if (!esOdoo && dominioMalo !== dominioBueno) {
      await fetch(`https://api.vercel.com/v9/projects/${projectData.id}/domains/${dominioMalo}${teamQuery}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      }).catch(()=>{})
    }
    // --- FIN FIX DOMINIO SIIGO ---

    // 4. Consigue el repoId del repo de GitHub conectado
    // Lo necesitamos después para decirle a Vercel desde qué repo desplegar
    // A veces Vercel no lo devuelve de inmediato, por eso esperamos 2 segundos y volvemos a preguntar
    let repoId = projectData?.link?.repoId
    if (!repoId) {
      await new Promise(r => setTimeout(r, 2000))
      const resGet = await fetch(`https://api.vercel.com/v10/projects/${projectData.id}${teamQuery}`, {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      })
      const projectFull = await resGet.json()
      repoId = projectFull?.link?.repoId
      projectData = projectFull
    }
    // Si después de reintentar sigue sin repoId, no podemos seguir
    if (!repoId) throw new Error(`No se pudo obtener repoId`)

    // 5. Prepara las variables de entorno que va a tener el proyecto del cliente
    // Son las keys propias de ese cliente, no las de la Fábrica
    // --- NUEVO: Ahora guarda ERP_PROVIDER y guarda Siigo o Odoo según lo que eligió la fábrica ---
    const envs = [
        { key: 'ERP_PROVIDER', value: provider },
        { key: 'CLIENTIFY_API_KEY', value: clientifyApiKey?.toString().trim() },
        { key: 'CLIENTE_NOMBRE', value: nombreCliente?.toString().trim() },
        // Siigo (solo si la fábrica eligió Siigo)
        ...(esOdoo ? [] : [
          { key: 'SIIGO_USER', value: siigoUser?.toString().trim() },
          { key: 'SIIGO_ACCESS_KEY', value: siigoAccessKey?.toString().trim() },
        ]),
        // Odoo (solo si la fábrica eligió Odoo)
        ...(esOdoo ? [
          { key: 'ODOO_URL', value: odooUrl?.toString().trim() },
          { key: 'ODOO_DB', value: odooDb?.toString().trim() },
          { key: 'ODOO_USER', value: odooUser?.toString().trim() },
          { key: 'ODOO_API_KEY', value: odooApiKey?.toString().trim() },
        ] : []),
    ]

    // 6. Guarda cada variable de entorno en Vercel, una por una
    // type 'sensitive' = secreta, no se muestra en el dashboard. 'plain' = visible
    // target: se aplica a production, preview y development
    for (const env of envs) {
      if(!env.value) continue
      const isSecret = env.key.includes('API_KEY') || env.key.includes('ACCESS') || env.key.includes('USER') || env.key.includes('ODOO')
      await fetch(`https://api.vercel.com/v10/projects/${projectData.id}/env${teamQuery}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: env.key, 
          value: env.value, 
          type: isSecret ? 'sensitive' : 'plain',
          target: ['production','preview','development'] 
        }),
      })
      // Pausa de 800ms entre cada variable para no saturar la API de Vercel
      await new Promise(r => setTimeout(r, 800))
    }

    // Espera 2.5 segundos para que Vercel termine de guardar las variables antes de desplegar
    await new Promise(r => setTimeout(r, 2500))

    // 7. Lanza el primer deploy en producción del proyecto del cliente
    // Le dice a Vercel: despliega este proyecto, desde este repo, rama main
    const resDeploy = await fetch(`https://api.vercel.com/v13/deployments${teamQueryDeploy}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: cleanSlug, 
        project: projectData.id, 
        gitSource: { type: 'github', repo: TEMPLATE_REPO, repoId: repoId, ref: 'main' },
        target: 'production'
      }),
    })
    
    const deployData = await resDeploy.json()
    // Si el deploy falla, frenamos y mostramos el error de Vercel
    if (!resDeploy.ok) throw new Error(`FALLO DEPLOY: ${JSON.stringify(deployData)}`)

    // 7.5 CREA LOS CAMPOS EN CLIENTIFY (lo que faltaba)
    // Usa la API Key DEL CLIENTE que viene del formulario, no la de la Fábrica.
    // Crea 9 en Deal, 2 en Contacto y 2 en Empresa. Si falla, no frena todo,
    // solo guarda el error para mostrarlo en la pantalla.
    let campos = null
    let camposError = null
    if (clientifyApiKey) {
      try {
        campos = await ensureCustomFieldsV2(clientifyApiKey)
      } catch (e: any) {
        camposError = e.message
        console.error('Error creando campos Clientify:', e)
      }
    } else {
      camposError = 'No se envió clientifyApiKey, no se pudieron crear los campos'
    }

    // 8. Todo salió bien, devolvemos a la pantalla de la Fábrica la URL del proyecto, el webhook y los campos
    // La pantalla muestra esto con el letrero ✅ CREADO
    return NextResponse.json({ 
      success: true, 
      url: `https://${cleanSlug}.vercel.app`, 
      webhookUrl: `https://${cleanSlug}.vercel.app/api/webhook/clientify`,
      campos,
      camposError,
    })

  } catch (e:any) {
    // Si algo falló en cualquier paso anterior, devuelve el error a la pantalla
    // La pantalla lo muestra en rojo
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
