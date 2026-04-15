import './globals.css'

export const metadata = {
  title: 'Order System',
  description: 'Agent order system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}