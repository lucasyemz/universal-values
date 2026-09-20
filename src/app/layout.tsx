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

export const metadata: Metadata = {
  title: { default: "CopyReplace", template: "%s · CopyReplace" },
  applicationName: "CopyReplace",
  icons: { icon: { url: "/brand/icon-blue.svg", type: "image/svg+xml" } },
  description: "Encontre conteúdo repetido no Webflow. Revise cada ocorrência e substitua com segurança.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={geist.variable}><body>{children}</body></html>;
}
