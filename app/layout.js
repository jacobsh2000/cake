import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Columbus Cake Celebrations",
  description: "Request or deliver a birthday cake for a child in need.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ margin: 0 }}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
