import { Inter } from "next/font/google";
import "./globals.css";
import Header from './components/header';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "Chemik Scada",
  description: "Chemik Scada",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning={true}>
      <head>
        {/* Script para prevenir flash de tema incorrecto */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
                  document.documentElement.className = '${inter.variable} ' + theme;
                  if (!savedTheme) {
                    localStorage.setItem('theme', theme);
                  }
                } catch (e) {
                  console.warn('Error setting theme:', e);
                  document.documentElement.className = '${inter.variable} light';
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-inter antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
