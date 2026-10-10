import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { nombreCliente, slug, clientifyApiKey, siigoUser, siigoAccessKey } = await req.json()
    if (!slug) return NextResponse.json({ error: 'Falta slug' }, { status: 400 })

    const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
    const TEMPLATE_REPO = process.env.TEMPLATE_GITHUB_REPO!
    const baseSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const cleanSlug = `${baseSlug}-conexion-clientify-siigo`

    // 1. Crear proyecto
    const resProject = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanSlug,
        gitRepository: { type: 'github', repo: TEMPLATE_REPO },
        framework: 'nextjs',
      }),
    })
    const projectData = await resProject.json()
    if (!resProject.ok) throw new Error(JSON.stringify(projectData))

    // 2. Env vars del cliente
    const envs = [
      { key: 'CLIENTIFY_API_KEY', value: clientifyApiKey },
    //  { key: 'SIIGO_USER', value: siigoUser },
    //  { key: 'SIIGO_ACCESS_KEY', value: siigoAccessKey },
      { key: 'CLIENTE_NOMBRE', value: nombreCliente },
    ]
    for (const env of envs) {
      if(!env.value) continue
      await fetch(`https://api.vercel.com/v10/projects/${projectData.id}/env`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: env.key, value: env.value, type: 'encrypted', target: ['production','preview','development'] }),
      })
    }

    // 3. Deploy inicial
    await new Promise(r => setTimeout(r, 2500)) // Esperar que se guarden las env vars

    const resDeploy = await fetch(`https://api.vercel.com/v13/deployments?forceNew=1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: cleanSlug, 
        project: projectData.id, 
        gitSource: { type: 'github', repo: TEMPLATE_REPO, ref: 'main' },
        target: 'production'
      }),
    })
    const deployData = await resDeploy.json()
    console.log('Deploy response:', deployData)
    // No hacemos throw si falla, porque Vercel igual lo autodespliega por el link de GitHub

        const deployData = await resDeploy.json()
    console.log('Deploy response:', deployData)

    return NextResponse.json({ 
      success: true, 
      url: `https://${cleanSlug}.vercel.app`, 
      webhookUrl: `https://${cleanSlug}.vercel.app/api/webhook/clientify`, 
      projectId: projectData.id,
      deploy: deployData
    })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
  
  }
}
