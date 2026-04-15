'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function getAgentSlug(row) {
  return row.agent_slug || row.slug || ''
}

function getAgentName(row) {
  return row.agent_name || row.name || '-'
}

function getAgentCode(row) {
  return row.code || '-'
}

function getAgentLevel(row) {
  return row.level ?? '-'
}

function getAgentCounter(row) {
  return row.order_counter ?? 0
}

function getAgentStatus(row) {
  if (row.is_active === false) {
    return {
      label: '停用',
      color: '#b91c1c',
      bg: '#fff1f2',
      border: '#fecdd3',
    }
  }

  return {
    label: '启用中',
    color: '#166534',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  }
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchAgents()
  }, [])

  async function fetchAgents() {
    try {
      setLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setAgents(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setMessage(error.message || '读取代理失败')
    } finally {
      setLoading(false)
    }
  }

  async function copyAgentLink(row) {
    try {
      const slug = getAgentSlug(row)

      if (!slug) {
        setMessage('这个代理还没有 slug / agent_slug')
        return
      }

      const link = `${window.location.origin}/order2/${slug}`
      await navigator.clipboard.writeText(link)
      setMessage(`已复制代理链接：${link}`)
    } catch (error) {
      console.error(error)
      setMessage(error.message || '复制链接失败')
    }
  }

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return agents.filter((row) => {
      if (!keyword) return true

      return [
        row.agent_name,
        row.name,
        row.code,
        row.slug,
        row.agent_slug,
        String(row.level ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [agents, search])

  const stats = useMemo(() => {
    const total = agents.length
    const active = agents.filter((a) => a.is_active !== false).length
    const inactive = agents.filter((a) => a.is_active === false).length

    return { total, active, inactive }
  }, [agents])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7efe7',
        padding: 24,
        color: '#6f4e37',
      }}
    >
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>Agent 管理</h1>
            <div style={{ marginTop: 8, color: '#8a6a54', fontSize: 14 }}>
              查看代理资料、等级、链接与下单计数
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/admin" style={secondaryLinkStyle}>
              返回后台首页
            </Link>

            <button type="button" onClick={fetchAgents} style={primaryButton}>
              刷新代理
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div style={statCardStyle}>
            <div style={statLabelStyle}>总代理数量</div>
            <div style={statValueStyle}>{stats.total}</div>
          </div>

          <div style={statCardStyle}>
            <div style={statLabelStyle}>启用中</div>
            <div style={statValueStyle}>{stats.active}</div>
          </div>

          <div style={statCardStyle}>
            <div style={statLabelStyle}>停用</div>
            <div style={statValueStyle}>{stats.inactive}</div>
          </div>
        </div>

        <div style={boxStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <input
              placeholder="搜索 agent 名称 / code / slug / level"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />

            <div style={{ color: '#8a6a54', fontWeight: 700 }}>
              共 {filteredAgents.length} 位代理
            </div>
          </div>
        </div>

        {message ? <div style={messageStyle}>{message}</div> : null}

        <div style={boxStyle}>
          {loading ? (
            <div>读取中...</div>
          ) : filteredAgents.length === 0 ? (
            <div>没有找到代理</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>代理名</th>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Slug</th>
                    <th style={thStyle}>等级</th>
                    <th style={thStyle}>订单计数</th>
                    <th style={thStyle}>状态</th>
                    <th style={thStyle}>创建时间</th>
                    <th style={thStyle}>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAgents.map((row) => {
                    const status = getAgentStatus(row)
                    const slug = getAgentSlug(row)

                    return (
                      <tr key={row.id}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800 }}>{getAgentName(row)}</div>
                        </td>

                        <td style={tdStyle}>{getAgentCode(row)}</td>

                        <td style={tdStyle}>
                          <div style={{ fontFamily: 'monospace' }}>{slug || '-'}</div>
                        </td>

                        <td style={tdStyle}>{getAgentLevel(row)}</td>

                        <td style={tdStyle}>{getAgentCounter(row)}</td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              height: 30,
                              padding: '0 12px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                              color: status.color,
                              background: status.bg,
                              border: `1px solid ${status.border}`,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td style={tdStyle}>{formatDateTime(row.created_at)}</td>

                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => copyAgentLink(row)}
                              style={smallPrimaryButton}
                            >
                              复制链接
                            </button>

                            {slug ? (
                              <a
                                href={`/order2/${slug}`}
                                target="_blank"
                                rel="noreferrer"
                                style={smallSecondaryLink}
                              >
                                打开前台
                              </a>
                            ) : (
                              <span style={{ color: '#b08968', fontSize: 13 }}>
                                无链接
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

const boxStyle = {
  background: '#fffaf5',
  border: '1px solid #ead7c4',
  borderRadius: 20,
  padding: 20,
  marginBottom: 20,
}

const statCardStyle = {
  background: '#fffaf5',
  border: '1px solid #ead7c4',
  borderRadius: 20,
  padding: 20,
}

const statLabelStyle = {
  color: '#8a6a54',
  fontWeight: 700,
  marginBottom: 8,
}

const statValueStyle = {
  fontSize: 28,
  fontWeight: 900,
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
}

const primaryButton = {
  height: 46,
  padding: '0 18px',
  borderRadius: 14,
  border: '1px solid #a47c57',
  background: '#a47c57',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 46,
  padding: '0 18px',
  borderRadius: 14,
  border: '1px solid #d7bfa8',
  background: '#fff8f1',
  color: '#6f4e37',
  fontWeight: 800,
  textDecoration: 'none',
}

const smallPrimaryButton = {
  height: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #a47c57',
  background: '#a47c57',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const smallSecondaryLink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #d7bfa8',
  background: '#fff8f1',
  color: '#6f4e37',
  fontWeight: 700,
  textDecoration: 'none',
}

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  borderBottom: '1px solid #ead7c4',
  whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #f0e3d6',
  verticalAlign: 'top',
}

const messageStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px solid #d8b99d',
}