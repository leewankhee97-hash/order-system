'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAgents()
  }, [])

  async function loadAgents() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('agents')
        .select('id, code, name, slug, is_active')
        .eq('is_active', true)
        .order('code', { ascending: true })

      if (error) throw error

      setAgents(data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* 标题 */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold">Order System</h1>
          <p className="mt-3 text-gray-600">
            代理专属下单系统（自动识别代理）
          </p>
        </section>

        {/* 后台入口 */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-xl font-semibold">后台入口</h2>

          <div className="mt-4 flex flex-wrap gap-4">
            <a
              href="/agents"
              className="rounded-xl bg-black px-5 py-3 text-white"
            >
              代理后台
            </a>

            <a
              href="/orders"
              className="rounded-xl border px-5 py-3"
            >
              订单列表（如有）
            </a>
          </div>
        </section>

        {/* 代理列表 */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-xl font-semibold">代理下单入口</h2>

          {loading && (
            <div className="mt-4 text-gray-500">
              Loading agents...
            </div>
          )}

          {error && (
            <div className="mt-4 text-red-500">
              {error}
            </div>
          )}

          {!loading && !error && agents.length === 0 && (
            <div className="mt-4 text-gray-500">
              没有代理，请先去后台创建
            </div>
          )}

          {!loading && agents.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {agents.map((agent) => (
                <a
                  key={agent.id}
                  href={`/order/${agent.slug}`}
                  className="rounded-2xl border p-5 transition hover:border-black hover:shadow"
                >
                  <div className="text-lg font-semibold">
                    {agent.code || '-'}
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {agent.name || '-'}
                  </div>

                  <div className="mt-2 text-xs text-gray-400">
                    /order/{agent.slug}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}