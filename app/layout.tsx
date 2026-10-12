import './globals.css';
import { ToastProvider } from '@/lib/toast';

export const metadata = {
  title: { default: 'SOURA DIGITAL', template: '%s · SOURA DIGITAL' },
  description: 'La plateforme de gestion pour les entreprises BTP et les pharmacies : ventes, stock, équipes et chantiers.',
};

export const viewport = { themeColor: '#0A0E13' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
