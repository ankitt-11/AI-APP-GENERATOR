import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: {
    default: 'AI App Generator',
    template: '%s | AI App Generator',
  },
  description:
    'A metadata-driven application runtime that converts JSON configuration into working applications with dynamic UI, APIs, and workflows.',
  keywords: ['app builder', 'low-code', 'metadata-driven', 'internal tools'],
  authors: [{ name: 'AI App Generator' }],
  openGraph: {
    type: 'website',
    title: 'AI App Generator',
    description: 'Build applications from metadata — no code generation.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              expand
              closeButton
            />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
