import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "House Scheduler",
  description: "Request and view room availability for the house.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
      <html
        lang="en"
        className={`${geistSans.variable} h-full antialiased`}
      >
      <body className="min-h-full flex flex-col bg-page text-fg">
        {children}
      </body>
    </html>
  );
}