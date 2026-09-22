import { NextIntlClientProvider } from "next-intl";
import { getText } from "@/i18n/server";
import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  src: [
    { path: "../../public/brand/fonts/geist-regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/brand/fonts/geist-medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/brand/fonts/geist-semibold.ttf", weight: "600", style: "normal" },
    { path: "../../public/brand/fonts/geist-bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-geist", display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getText();
  return {
  title: { default: "ReplaceAll", template: "%s · ReplaceAll" },
  applicationName: "ReplaceAll",
  icons: { icon: { url: "/brand/icon-blue.svg", type: "image/svg+xml" } },
  description: t("Encontre e atualize textos, imagens e links no Webflow. Revise cada ocorrência e substitua com segurança."),
};
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale} className={geist.variable}><body><NextIntlClientProvider>{children}</NextIntlClientProvider></body></html>;
}
