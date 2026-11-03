import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI创作台 · UI工作室",
  description: "用自然语言创作图片和Icon，参考、生成、修改和交付连在一起。",
  icons: {
    icon: "/splitter/favicon.svg",
    shortcut: "/splitter/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
