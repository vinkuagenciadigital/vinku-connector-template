import './globals.css'
export const metadata = { title: 'Vinku Connector', description: 'Clientify -> Siigo' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>)
}
