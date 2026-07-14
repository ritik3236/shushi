import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AuthUIProvider } from "@/components/providers/auth-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { APP_NAME, APP_TAGLINE, APP_URL } from "@/lib/constants"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Personal expense tracker: import bank and credit card statements, categorize spending, track payouts.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body data-app className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          <AuthUIProvider className="flex flex-1 flex-col">
            {children}
            <Toaster richColors position="top-right" />
          </AuthUIProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
