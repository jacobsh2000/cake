import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Columbus Cake Celebrations",
  description: "Request or deliver a birthday cake for a child in need.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body style={{ margin: 0 }}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
