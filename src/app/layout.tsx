import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "联盟营销数据统计 - Affiliate Dashboard",
  description:
    "自动统计 Google Ads 与联盟营销数据，按日期和广告系列匹配对应",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
