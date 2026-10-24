import './globals.css';
import '../client/index.css';

export const metadata = {
  title: 'HCM Lite',
  description: 'AI-assisted HR system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
