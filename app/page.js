'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function getSiteUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  return ''
}

export default function HomePage() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')

  useEffect(() => {
    loadAgents()
  }, [])

  async function loadAgents() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('agents')
        .select('id, code, name, slug, is_active, level')
        .eq('is_active', true)
        .order('id', { ascending: true })

      if (error) throw error

      setAgents(data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const siteUrl = useMemo(() => getSiteUrl(), [])

  async function copyLink(link, id) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(String(id))
      setTimeout(() => {
        setCopiedId('')
      }, 1500)
    } catch (err) {
      console.error(err)
      alert('复制失败，请手动复制链接')
    }
  }

  return (
    <main className="min-h-screen bg-[#f6efe8] p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-[#5f3d2e] md:text-4xl">
            Order System
          </h1>
          <p className="mt-3 text-sm text-[#7b5a49] md:text-base">
            代理专属下单系统（自动识别代理）
          </p>
        </section>

        <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-[#5f3d2e]">后台入口</h2>

          <div className="mt-4 flex flex-wrap gap-4">
            <a
              href="/agents"
              className="rounded-2xl bg-[#6f4b3e] px-5 py-3 text-white transition hover:bg-[#5f3d2e]"
            >
              代理后台
            </a>

            <a
              href="/orders"
              className="rounded-2xl border border-[#d9c3ae] bg-white px-5 py-3 text-[#5f3d2e] transition hover:border-[#c8a487]"
            >
              订单列表（如有）
            </a>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#5f3d2e]">代理下单入口</h2>
              <p className="mt-2 text-sm text-[#8b6a57]">
                显示代理名字与专属链接，方便你复制与管理
              </p>
            </div>

            {!loading && !error && agents.length > 0 ? (
              <div className="rounded-full bg-[#f4e2d1] px-4 py-2 text-sm text-[#7a5642]">
                共 {agents.length} 位代理
              </div>
            ) : null}
          </div>

          {loading && (
            <div className="mt-5 rounded-2xl border border-dashed border-[#dcc4b0] p-4 text-sm text-[#8b6a57]">
              Loading agents...
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && agents.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-[#dcc4b0] p-4 text-sm text-[#8b6a57]">
              没有代理，请先去后台创建
            </div>
          )}

          {!loading && !error && agents.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => {
                const agentId = String(agent.id ?? '').trim()
                const displayName =
                  String(agent.name || '').trim() ||
                  String(agent.code || '').trim() ||
                  `代理 ${agentId}`

                const code = String(agent.code || '').trim()
                const fullLink = agentId ? `${siteUrl}/order2/${agentId}` : ''

                return (
                  <div
                    key={agent.id}
                    className="rounded-[24px] border border-[#e8d8c8] bg-white p-5 shadow-sm transition hover:border-[#c8a487] hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-[#5f3d2e]">
                          {displayName}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8b6a57]">
                          {code ? (
                            <span className="rounded-full bg-[#f8f1ea] px-2.5 py-1">
                              Code: {code}
                            </span>
                          ) : null}

                          {agent.level ? (
                            <span className="rounded-full bg-[#f4e2d1] px-2.5 py-1 text-[#7a5642]">
                              Level {agent.level}
                            </span>
                          ) : null}

                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                            Active
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#8b6a57]">
                        专属链接
                      </div>

                      <div className="rounded-2xl border border-[#eee2d6] bg-[#fcf8f4] p-3">
                        <div className="break-all text-sm text-[#5f3d2e]">
                          {fullLink || '尚未生成链接'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(fullLink, agent.id)}
                        disabled={!fullLink}
                        className="flex-1 rounded-2xl bg-[#6f4b3e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#5f3d2e] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {copiedId === String(agent.id) ? '已复制' : '复制链接'}
                      </button>

                      <a
                        href={fullLink || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                          fullLink
                            ? 'border-[#d9c3ae] bg-white text-[#5f3d2e] hover:border-[#c8a487]'
                            : 'pointer-events-none border-[#eee2d6] bg-[#faf7f3] text-[#b8a08d]'
                        }`}
                      >
                        打开页面
                      </a>
                    </div>

                    {agentId ? (
                      <div className="mt-3 text-xs text-[#9a7c67]">
                        路径：/order2/{agentId}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}