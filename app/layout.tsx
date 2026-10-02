import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import './workspace.css';
import './focus-timeline.css';
import './learn/learn.css';
import './light.css';
import './light-fixes.css';
export const metadata: Metadata = {
  title: 'OpenMRI — local MRI viewer',
  description:
    'View your own MRI and CT studies in 3D and on three slices, locally.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
