import "./global.css";
import AuthSessionProvider from "../components/AuthSessionProvider";
import { UndoProvider } from "../components/UndoProvider";
import Navbar from "../components/navbar.js";

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
          <UndoProvider>
            <Navbar />
            {children}
          </UndoProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
