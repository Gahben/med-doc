import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'MedDoc - Repositório de Prontuários',
  description: 'Sistema de gestão de prontuários médicos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.variable} ${dmMono.variable} font-sans`}>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1a1916',
                color: '#fff',
                borderRadius: '9px',
                padding: '12px 18px',
              },
              success: {
                iconTheme: {
                  primary: '#4ade80',
                  secondary: '#1a1916',
                },
              },
              error: {
                style: {
                  background: '#c0392b',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
