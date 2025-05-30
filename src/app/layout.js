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
    <html lang="es" className={inter.variable}>
      <body className={`font-inter antialiased`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
