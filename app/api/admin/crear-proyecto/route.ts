import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { nombreCliente, slug, clientifyApiKey, siigoUser, siigoAccessKey } = await req.json()
    if (!slug) return NextResponse.json({ error: 'Falta slug' }, { status: 400 })

    const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
    const TEMPLATE_REPO = process.env.TEMPLATE_GITHUB_REPO!
    const TEAM_ID = process.env.VERCEL_TEAM_ID || ''
    
    const baseSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const cleanSlug = `${baseSlug}-conexion-clientify-siigo`

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

    // DATOS SOLCIITADOS PARA CONECTAR CLIENTIFY Y SIIGO
   const envs = [
        { key: 'CLIENTIFY_API_KEY', value: clientifyApiKey?.toString().trim() },
        { key: 'CLIENTE_NOMBRE', value: nombreCliente?.toString().trim() },
     // { key: 'SIIGO_USER', value: siigoUser?.toString().trim() },
     // { key: 'SIIGO_ACCESS_KEY', value: siigoAccessKey?.toString().trim() },
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
