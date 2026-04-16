'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'prolee97@hotmail.com' // 一定要改

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkExistingLogin()
  }, [])

  async function checkExistingLogin() {
    const { data } = await supabase.auth.getUser()
    const user = data?.user

    if (user?.email === ADMIN_EMAIL) {
      router.replace('/admin')
      return
    }

    if (user && user.email !== ADMIN_EMAIL) {
      await supabase.auth.signOut()
    }

    setChecking(false)
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const loginEmail = email.trim()

      if (!loginEmail) throw new Error('请输入邮箱')
      if (!password.trim()) throw new Error('请输入密码')

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })

      if (error) throw error

      const user = data?.user

      if (!user) {
        throw new Error('登录成功，但没有取得用户资料')
      }

      if (user.email !== ADMIN_EMAIL) {
        await supabase.auth.signOut()
        throw new Error('这个账号没有后台权限')
      }

      setMessage('登录成功，正在进入后台...')
      router.replace('/admin')
    } catch (error) {
      setMessage(error.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <main style={wrapStyle}>
        <div style={cardStyle}>Checking login...</div>
      </main>
    )
  }

  return (
    <main style={wrapStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: '#6f4e37' }}>
          Admin Login
        </h1>

        <div style={{ fontSize: 14, color: '#9a7b63', marginBottom: 18 }}>
          只有管理员账号可以进入后台
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入管理员邮箱"
              style={inputStyle}
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>

          {message ? (
            <div style={messageStyle}>
              {message}
            </div>
          ) : null}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? '登录中...' : '登录后台'}
          </button>
        </form>
      </div>
    </main>
  )
}

const wrapStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f7efe7',
  padding: 24,
}

const cardStyle = {
  width: '100%',
  maxWidth: 440,
  background: '#fffaf5',
  border: '1px solid #ead7c4',
  borderRadius: 24,
  padding: 28,
  boxShadow: '0 10px 30px rgba(111, 78, 55, 0.08)',
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 800,
  color: '#7b5a43',
  marginBottom: 8,
}

const inputStyle = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid #d7bfa8',
  background: '#fff',
  padding: '0 12px',
  outline: 'none',
  color: '#6f4e37',
  fontSize: 15,
}

const buttonStyle = {
  width: '100%',
  height: 48,
  marginTop: 8,
  borderRadius: 14,
  border: '1px solid #a47c57',
  background: '#a47c57',
  color: '#fff',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
}

const messageStyle = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px solid #d8b99d',
  color: '#6f4e37',
  fontSize: 14,
  lineHeight: 1.6,
}