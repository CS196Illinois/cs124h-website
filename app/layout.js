import "./global.css";
import AuthSessionProvider from "../components/AuthSessionProvider";
import Navbar from "../components/navbar.js";
import ChatWidget from "../components/ChatWidget";

export const metadata = {
  title: "CS124H",
  description: "CS 124H Website",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>
          <Navbar />
          {children}
          <ChatWidget />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
