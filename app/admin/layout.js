'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const menuItems = [
  { label: '🏠 Dashboard', href: '/admin' },
  { label: '📦 Products', href: '/admin/products' },
  { label: '🧾 Orders', href: '/admin/orders' },
  { label: '🎁 Bundles', href: '/admin/bundles' },
  { label: '👥 Agents', href: '/admin/agents' },
]

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin'
    return pathname?.startsWith(href)
  }

  function handleLogout() {
    router.push('/')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7efe7',
        padding: 24,
        color: '#6f4e37',
      }}
    >
      <div
        style={{
          maxWidth: 1800,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <aside
          style={{
            background: '#fffaf5',
            border: '1px solid #ead7c4',
            borderRadius: 24,
            padding: 18,
            position: 'sticky',
            top: 24,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 18 }}>
            后台管理
          </div>

          <div
            style={{
              border: '1px solid #ead7c4',
              borderRadius: 18,
              padding: 14,
              background: '#fff',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: '#8a6a54',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              当前管理员
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              prolee97@hotmail.com
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {menuItems.map((item) => {
              const active = isActive(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 46,
                    padding: '0 16px',
                    borderRadius: 16,
                    border: active ? '1px solid #a47c57' : '1px solid #ead7c4',
                    background: active ? '#a47c57' : '#fff',
                    color: active ? '#fff' : '#6f4e37',
                    textDecoration: 'none',
                    fontWeight: 800,
                  }}
                >
                  {item.label}
                </Link>
              )
            })}

            <button
              type="button"
              onClick={handleLogout}
              style={{
                marginTop: 4,
                minHeight: 46,
                borderRadius: 16,
                border: '1px solid #e7b9b9',
                background: '#fff4f4',
                color: '#b24f4f',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </aside>

        <section style={{ minWidth: 0 }}>
          {children}
        </section>
      </div>
    </main>
  )
}