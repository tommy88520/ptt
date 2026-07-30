import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "PTT MacShop 雷達｜關鍵字訂閱通知,二手 iPhone/Mac 特價提醒";
const DESCRIPTION =
  "自動監控 PTT MacShop 版最新文章,訂閱關鍵字(例如 iPhone 17、MacBook、AirPods)符合就用 Discord 私訊通知你,不用一直刷新 PTT。支援網頁搜尋與訂閱管理,免費使用。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "PTT MacShop",
    "PTT 通知",
    "PTT 關鍵字通知",
    "PTT 訂閱",
    "PTT Discord 通知",
    "PTT 機器人",
    "PTT iPhone 通知",
    "PTT 二手 iPhone 提醒",
    "MacShop 版",
    "PTT 監控工具",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "zh_TW",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
