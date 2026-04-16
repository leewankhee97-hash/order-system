'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'yourmail@gmail.com' // 改成你自己的邮箱

export default function AdminLayout({ children }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data, error } = await supabase.auth.getUser()
    const user = data?.user

    if (error || !user) {
      router.replace('/login')
      return
    }

    if (user.email !== ADMIN_EMAIL) {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }

    setAdminEmail(user.email || '')
    setChecking(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f7efe7',
          color: '#6f4e37',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        Checking admin access...
      </div>
    )
  }

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
                marginBottom: 16,
                padding: 12,
                borderRadius: 12,
                background: '#fff',
                border: '1px solid #ead7c4',
                fontSize: 13,
                lineHeight: 1.6,
                wordBreak: 'break-word',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>当前管理员</div>
              <div>{adminEmail}</div>
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

              <button
                type="button"
                onClick={handleLogout}
                style={logoutButtonStyle}
              >
                Logout
              </button>
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

const logoutButtonStyle = {
  display: 'block',
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  color: '#a14f4f',
  background: '#fff4f4',
  border: '1px solid #e7bcbc',
  fontWeight: 700,
  cursor: 'pointer',
}