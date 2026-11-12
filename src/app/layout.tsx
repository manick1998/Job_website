import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Manick Job Portal | Find Your Dream Job. Build Your Future.",
    template: "%s | Manick Job Portal",
  },
  description:
    "Manick Job Portal is India's bridge between talent and opportunity. Search verified jobs, apply in one click, and hire faster with our applicant tracking system.",
  openGraph: {
    title: "Manick Job Portal | Find Your Dream Job. Build Your Future.",
    description: "Search verified jobs across India, track applications and hire with an AI-ready ATS.",
    url: APP_URL,
    siteName: "Manick Job Portal",
    type: "website",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Manick Job Portal" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Manick Job Portal | Find Your Dream Job. Build Your Future.",
    description: "Search verified jobs across India, track applications and hire with an AI-ready ATS.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: APP_URL },
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
