import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth/auth-context"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Operations Dashboard",
    template: "%s | Operations Dashboard",
  },
  description: "Professional enterprise operations dashboard for WebSocket proxy monitoring and management",
  keywords: ["operations", "dashboard", "monitoring", "websocket", "proxy", "enterprise"],
  authors: [{ name: "Operations Team" }],
  creator: "Operations Team",
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Operations Dashboard",
    description: "Professional enterprise operations dashboard for WebSocket proxy monitoring and management",
    siteName: "Operations Dashboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Operations Dashboard",
    description: "Professional enterprise operations dashboard for WebSocket proxy monitoring and management",
  },
  robots: {
    index: false, // Internal dashboard
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}