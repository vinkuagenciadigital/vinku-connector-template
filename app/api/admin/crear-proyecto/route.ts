import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { nombreCliente, slug, clientifyApiKey, siigoUser, siigoAccessKey } = await req.json()
    if (!slug) return NextResponse.json({ error: 'Falta slug' }, { status: 400 })

    const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
    const TEMPLATE_REPO = process.env.TEMPLATE_GITHUB_REPO!
    const TEAM_ID = process.env.VERCEL_TEAM_ID || ''
    
    // 1. Normaliza
    let baseSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '')

    // 2. FIX SIIGO: Corrige si viene sin la o y evita duplicar el sufijo
    baseSlug = baseSlug.replace(/siig$/i, 'siigo') // si termina en siig -> siigo
    baseSlug = baseSlug.replace(/conexion-clientify-siig$/i, 'conexion-clientify-siigo')

    let cleanSlug = baseSlug
    if (!cleanSlug.includes('conexion-clientify-siigo')) {
      cleanSlug = `${cleanSlug}-conexion-clientify-siigo`
    }
    // Garantía final: si por cualquier cosa aún termina en siig, lo corrige
    cleanSlug = cleanSlug.replace(/-siig$/i, '-siigo')
    cleanSlug = cleanSlug.slice(0, 96) // Vercel max 100, dejamos margen

    const teamQuery = TEAM_ID ? `?teamId=${TEAM_ID}` : ''
    const teamQueryDeploy = TEAM_ID ? `?forceNew=1&teamId=${TEAM_ID}` : '?forceNew=1'

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
    if (!resProject.ok) throw new Error(JSON.stringify(projectData))

    // --- INICIO FIX DOMINIO SIIGO (agregado) ---
    const dominioBueno = `${cleanSlug}.vercel.app`
    const dominioMalo = `${cleanSlug.replace(/siigo$/i, 'siig')}.vercel.app`
    
    // Asegura que el dominio bueno exista
    await fetch(`https://api.vercel.com/v9/projects/${projectData.id}/domains${teamQuery}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: dominioBueno }),
    }).catch(()=>{})

    // Borra el dominio malo si Vercel lo creó
    if (dominioMalo !== dominioBueno) {
      await fetch(`https://api.vercel.com/v9/projects/${projectData.id}/domains/${dominioMalo}${teamQuery}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      }).catch(()=>{})
    }
    // --- FIN FIX DOMINIO SIIGO ---

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
    if (!repoId) throw new Error(`No se pudo obtener repoId`)

    const envs = [
        { key: 'CLIENTIFY_API_KEY', value: clientifyApiKey?.toString().trim() },
        { key: 'CLIENTE_NOMBRE', value: nombreCliente?.toString().trim() },
    ]

    for (const env of envs) {
      if(!env.value) continue
      const isSecret = env.key.includes('API_KEY') || env.key.includes('ACCESS') || env.key.includes('USER')
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
      await new Promise(r => setTimeout(r, 800))
    }

    await new Promise(r => setTimeout(r, 2500))

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
    if (!resDeploy.ok) throw new Error(`FALLO DEPLOY: ${JSON.stringify(deployData)}`)

    return NextResponse.json({ 
      success: true, 
      url: `https://${cleanSlug}.vercel.app`, 
      webhookUrl: `https://${cleanSlug}.vercel.app/api/webhook/clientify`, 
    })

  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
