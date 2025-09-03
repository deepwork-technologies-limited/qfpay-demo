import type { Metadata } from "next";
import "./globals.css";
import SDKLoader from "./SDKLoader";

export const metadata: Metadata = {
  title: "QFPay Demo",
  description: "QFPay Payment Integration Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SDKLoader />
        {children}
      </body>
    </html>
  );
}
