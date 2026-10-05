import './globals.css';
import { ToastProvider } from '@/lib/toast';

export const metadata = {
  title: 'SOURA DIGITAL — CRM BTP',
  description: 'Gestion de chantiers, budgets et équipes pour entreprises BTP.',
};

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
