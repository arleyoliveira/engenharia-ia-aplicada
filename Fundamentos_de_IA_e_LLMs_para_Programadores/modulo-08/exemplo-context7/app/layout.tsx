import "../styles/globals.css";

export const metadata = {
  title: "Better Auth Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900">
        <main className="min-h-screen flex items-center justify-center">{children}</main>
      </body>
    </html>
  );
}
