'use client'

export default function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        alert('Copiado: ' + text)
      }}
      className="bg-white text-black px-4 rounded-lg font-medium h-[44px]"
    >
      Copiar
    </button>
  )
}
