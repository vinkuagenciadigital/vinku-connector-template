'use client'

import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="bg-[#8A6FE8] text-white px-5 rounded-lg font-medium h-[44px] hover:bg-[#7a5fe0] active:bg-[#6a4ed0] transition-colors shadow-sm min-w-[110px]"
    >
      {copied? '¡Copiado!' : 'Copiar'}
    </button>
  )
}
