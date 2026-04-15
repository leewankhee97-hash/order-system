import Link from 'next/link'

export default function AdminLayout({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7efe7',
        color: '#6f4e37',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: 20,
          }}
        >
          <aside
            style={{
              background: '#fffaf5',
              border: '1px solid #ead7c4',
              borderRadius: 20,
              padding: 20,
              height: 'fit-content',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginBottom: 18,
              }}
            >
              后台管理
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <Link href="/admin" style={linkStyle}>Dashboard</Link>
              <Link href="/admin/products" style={linkStyle}>Products</Link>
              <Link href="/admin/orders" style={linkStyle}>Orders</Link>
              <Link href="/admin/bundles" style={linkStyle}>Bundles</Link>
              <Link href="/admin/agents" style={linkStyle}>Agents</Link>
              <Link href="/admin/prices" style={linkStyle}>Prices</Link>
            </div>
          </aside>

          <main>{children}</main>
        </div>
      </div>
    </div>
  )
}

const linkStyle = {
  display: 'block',
  padding: '12px 14px',
  borderRadius: 12,
  textDecoration: 'none',
  color: '#6f4e37',
  background: '#fff',
  border: '1px solid #ead7c4',
  fontWeight: 700,
}