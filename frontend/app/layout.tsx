import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { KeyboardShortcutsProvider, KeyboardShortcutsHint } from '@/components/KeyboardShortcuts';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-ui',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-code',
});

export const metadata: Metadata = {
  title: 'Trende Control Room',
  description: 'Source, synthesize, and operationalize cross-platform trend intelligence.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} text-slate-100 min-h-screen antialiased`}>
        <ToastProvider>
          <KeyboardShortcutsProvider>
            {children}
            <KeyboardShortcutsHint />
          </KeyboardShortcutsProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
