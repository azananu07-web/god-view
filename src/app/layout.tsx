import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "God View – Agency Analytics Hub",
  description: "Every HighLevel sub-account on one screen: leaderboard, churn predictor and one-click snapshot push.",
};

// Apply the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('gv-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
