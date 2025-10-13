import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ServiceWorkerProvider } from "@/components/ServiceWorkerProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://talyon.asia'),
  title: {
    default: 'Talyon',
    template: '%s | Talyon',
  },
  description:
    'Talyon - Stop spraying resumes to 1000 jobs. Find your perfect job match in minutes with AI-powered scoring and matching.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Talyon',
    description:
      'Upload once and get AI-scored, high-quality job matches in Singapore.',
    url: 'https://talyon.asia',
    siteName: 'Talyon',
    locale: 'en_SG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}
