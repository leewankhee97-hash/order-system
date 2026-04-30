'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()

  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data } = await supabase.auth.getUser()

    if (!data?.user) {
      router.push('/login')
      return
    }

    setUserEmail(data.user.email || '')
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '🏠' },
    { href: '/admin/products', label: 'Products', icon: '📦' },
    { href: '/admin/orders', label: 'Orders', icon: '🧾' },
    { href: '/admin/bundles', label: 'Bundles', icon: '🎁' },
    { href: '/admin/agents', label: 'Agents', icon: '👥' },
  ]

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7efe6',
        color: '#6f4e37',
        fontWeight: 900,
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7efe6',
      color: '#4a3325',
    }}>
      <style>{`
        @media (max-width: 768px) {
          .admin-shell {
            display: block !important;
            padding: 10px !important;
          }

          .admin-sidebar {
            display: none !important;
          }

          .admin-mobile-header {
            display: block !important;
          }

          .admin-main {
            padding: 0 !important;
            width: 100% !important;
          }

          .admin-content {
            padding: 12px !important;
            border-radius: 18px !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }
        }

        @media (min-width: 769px) {
          .admin-mobile-header {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="admin-shell"
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 20,
          padding: 24,
          maxWidth: 1500,
          margin: '0 auto',
        }}
      >
        <aside
          className="admin-sidebar"
          style={{
            position: 'sticky',
            top: 24,
            height: 'calc(100vh - 48px)',
            padding: 24,
            borderRadius: 28,
            background: '#fffaf5',
            border: '1px solid #e2cdbb',
            boxShadow: '0 12px 30px rgba(111, 78, 55, 0.08)',
          }}
        >
          <h1 style={{
            fontSize: 30,
            fontWeight: 900,
            marginBottom: 28,
            lineHeight: 1.2,
          }}>
            后台管理
          </h1>

          <div style={{
            padding: 16,
            borderRadius: 18,
            border: '1px solid #e2cdbb',
            marginBottom: 20,
            background: '#fff',
            wordBreak: 'break-word',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.7 }}>
              当前管理员
            </div>
            <div style={{ marginTop: 8, fontWeight: 900 }}>
              {userEmail}
            </div>
          </div>

          <nav style={{ display: 'grid', gap: 12 }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '14px 18px',
                  borderRadius: 18,
                  textDecoration: 'none',
                  fontWeight: 900,
                  fontSize: 18,
                  background: isActive(item.href) ? '#9b7a5f' : '#fff',
                  color: isActive(item.href) ? '#fff' : '#4a3325',
                  border: '1px solid #e2cdbb',
                }}
              >
                {item.icon} {item.label}
              </Link>
            ))}

            <button
              onClick={logout}
              style={{
                marginTop: 8,
                padding: '14px 18px',
                borderRadius: 18,
                border: '1px solid #e2cdbb',
                background: '#fff5f5',
                color: '#9b3b3b',
                fontWeight: 900,
                fontSize: 18,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </nav>
        </aside>

        <main className="admin-main" style={{ minWidth: 0 }}>
          <div
            className="admin-mobile-header"
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 20,
              background: '#fffaf5',
              border: '1px solid #e2cdbb',
              boxShadow: '0 8px 20px rgba(111, 78, 55, 0.08)',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  后台管理
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  opacity: 0.7,
                  maxWidth: 210,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {userEmail}
                </div>
              </div>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 14,
                  border: '1px solid #d7bfa8',
                  background: '#fff',
                  fontWeight: 900,
                  color: '#6f4e37',
                }}
              >
                {menuOpen ? '关闭' : '菜单'}
              </button>
            </div>

            {menuOpen && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                marginBottom: 10,
              }}>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 14,
                      textDecoration: 'none',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: 14,
                      background: isActive(item.href) ? '#9b7a5f' : '#fff',
                      color: isActive(item.href) ? '#fff' : '#4a3325',
                      border: '1px solid #e2cdbb',
                    }}
                  >
                    {item.icon} {item.label}
                  </Link>
                ))}

                <button
                  onClick={logout}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 14,
                    border: '1px solid #e2cdbb',
                    background: '#fff5f5',
                    color: '#9b3b3b',
                    fontWeight: 900,
                    fontSize: 14,
                  }}
                >
                  Logout
                </button>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 2,
            }}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    flex: '0 0 auto',
                    padding: '9px 12px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    fontWeight: 900,
                    fontSize: 13,
                    background: isActive(item.href) ? '#9b7a5f' : '#fff',
                    color: isActive(item.href) ? '#fff' : '#4a3325',
                    border: '1px solid #e2cdbb',
                  }}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div
            className="admin-content"
            style={{
              padding: 24,
              borderRadius: 28,
              background: '#fffaf5',
              border: '1px solid #e2cdbb',
              minHeight: 'calc(100vh - 48px)',
              boxShadow: '0 12px 30px rgba(111, 78, 55, 0.08)',
              overflowX: 'auto',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}