'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

function normalizeText(value) {
  return (value || '').toString().trim()
}

function makeSlug(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function getSiteUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  return ''
}

function CorgiBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs text-amber-900 shadow-sm">
      <span>🐶</span>
      <span>corgi admin</span>
    </div>
  )
}

export default function AgentsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [search, setSearch] = useState('')

  const [agents, setAgents] = useState([])
  const [form, setForm] = useState({
    id: '',
    agent_name: '',
    code: '',
    name: '',
    slug: '',
    order_prefix: '',
    order_counter: 1,
    is_active: true,
  })

  const siteUrl = useMemo(() => getSiteUrl(), [])

  useEffect(() => {
    loadAgents()
  }, [])

  async function loadAgents() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('agents')
        .select(`
          id,
          agent_name,
          code,
          name,
          slug,
          agent_slug,
          order_prefix,
          order_counter,
          is_active,
          level,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load agents.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      id: '',
      agent_name: '',
      code: '',
      name: '',
      slug: '',
      order_prefix: '',
      order_counter: 1,
      is_active: true,
    })
    setError('')
    setSuccess('')
  }

  function handleSelectAgent(agent) {
    setForm({
      id: agent.id,
      agent_name: agent.agent_name || '',
      code: agent.code || '',
      name: agent.name || '',
      slug: agent.slug || agent.agent_slug || '',
      order_prefix: agent.order_prefix || '',
      order_counter: agent.order_counter || 1,
      is_active: !!agent.is_active,
    })
    setError('')
    setSuccess('')
  }

  async function saveAgent() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const code = normalizeText(form.code).toUpperCase()
      const agentName = normalizeText(form.agent_name || code)
      const displayName = normalizeText(form.name)
      const slug = makeSlug(form.slug || code)
      const orderPrefix = normalizeText(form.order_prefix || code).toUpperCase()
      const orderCounter = Number(form.order_counter || 1)

      if (!agentName) {
        setError('Agent name is required.')
        return
      }

      if (!code) {
        setError('Agent code is required.')
        return
      }

      if (!slug) {
        setError('Slug is required.')
        return
      }

      const payload = {
        agent_name: agentName,
        code,
        name: displayName || null,
        slug,
        agent_slug: slug,
        order_prefix: orderPrefix,
        order_counter: orderCounter < 1 ? 1 : orderCounter,
        is_active: !!form.is_active,
      }

      if (form.id) {
        const { error } = await supabase
          .from('agents')
          .update(payload)
          .eq('id', form.id)

        if (error) throw error
        setSuccess('Agent updated.')
      } else {
        const { error } = await supabase
          .from('agents')
          .insert(payload)

        if (error) throw error
        setSuccess('Agent created.')
      }

      resetForm()
      await loadAgents()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to save agent.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAgent() {
    try {
      if (!form.id) {
        setError('Please select an agent first.')
        return
      }

      const ok = window.confirm(`Delete agent "${form.code || form.agent_name}" ?`)
      if (!ok) return

      setSaving(true)
      setError('')
      setSuccess('')

      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', form.id)

      if (error) throw error

      setSuccess('Agent deleted.')
      resetForm()
      await loadAgents()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to delete agent.')
    } finally {
      setSaving(false)
    }
  }

  async function copyLink(link, id) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(id)
      setTimeout(() => {
        setCopiedId('')
      }, 1500)
    } catch (err) {
      console.error(err)
      setError('复制失败，请手动复制链接。')
    }
  }

  const filteredAgents = agents.filter((agent) => {
    const keyword = normalizeText(search).toLowerCase()
    if (!keyword) return true

    const haystack = [
      agent.code,
      agent.name,
      agent.agent_name,
      agent.slug,
      agent.agent_slug,
      agent.order_prefix,
    ]
      .map((v) => normalizeText(v).toLowerCase())
      .join(' ')

    return haystack.includes(keyword)
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6efe8] p-6">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-8 shadow-sm">
          Loading agents...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6efe8] p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[30px] border border-[#e7d5c2] bg-gradient-to-r from-[#fff7f0] to-[#f2e2d1] p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#5f3d2e]">代理后台</h1>
              <p className="mt-2 text-sm text-[#7b5a49]">
                管理代理代号、专属链接、自动订单编号
              </p>
            </div>
            <CorgiBadge />
          </div>
        </div>

        {error ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 shadow-sm">
            {success}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm xl:col-span-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#5f3d2e]">代理列表</h2>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl bg-[#6f4b3e] px-4 py-2 text-sm text-white transition hover:bg-[#5f3d2e]"
              >
                + New
              </button>
            </div>

            <div className="mb-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索代理名字 / code / slug"
                className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-sm text-[#5f3d2e] outline-none"
              />
            </div>

            <div className="space-y-3">
              {filteredAgents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dcc4b0] p-4 text-sm text-[#8b6a57]">
                  No agents found.
                </div>
              ) : (
                filteredAgents.map((agent) => {
                  const currentSlug = agent.slug || agent.agent_slug || ''
                  const displayName =
                    normalizeText(agent.name) ||
                    normalizeText(agent.agent_name) ||
                    normalizeText(agent.code) ||
                    '未命名代理'

                  const code = normalizeText(agent.code) || '-'
                  const fullLink = currentSlug ? `${siteUrl}/order/${currentSlug}` : ''

                  return (
                    <div
                      key={agent.id}
                      className="rounded-[22px] border border-[#e8d8c8] bg-white p-4 shadow-sm transition hover:border-[#c8a487]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => handleSelectAgent(agent)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-base font-bold text-[#5f3d2e]">
                            {displayName}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8b6a57]">
                            <span className="rounded-full bg-[#f8f1ea] px-2.5 py-1">
                              Code: {code}
                            </span>

                            {agent.level ? (
                              <span className="rounded-full bg-[#f4e2d1] px-2.5 py-1 text-[#7a5642]">
                                Level {agent.level}
                              </span>
                            ) : null}

                            <span
                              className={`rounded-full px-2.5 py-1 ${
                                agent.is_active
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {agent.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </button>

                        <span className="rounded-full bg-[#f4e2d1] px-2 py-1 text-xs text-[#7a5642]">
                          🐾
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl border border-[#eee2d6] bg-[#fcf8f4] p-3">
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8b6a57]">
                          专属链接
                        </div>
                        <div className="break-all text-xs text-[#5f3d2e]">
                          {fullLink || '尚未生成链接'}
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => copyLink(fullLink, agent.id)}
                          disabled={!fullLink}
                          className="flex-1 rounded-xl bg-[#6f4b3e] px-3 py-2 text-xs text-white transition hover:bg-[#5f3d2e] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {copiedId === agent.id ? '已复制' : '复制链接'}
                        </button>

                        <a
                          href={fullLink || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs transition ${
                            fullLink
                              ? 'border-[#d9c3ae] bg-white text-[#5f3d2e]'
                              : 'pointer-events-none border-[#eee2d6] bg-[#faf7f3] text-[#b8a08d]'
                          }`}
                        >
                          打开
                        </a>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-[#8b6a57]">
                        <div>Path: {currentSlug ? `/order/${currentSlug}` : '-'}</div>
                        <div>
                          Prefix: {agent.order_prefix || '-'} | Counter: {agent.order_counter || 1}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm xl:col-span-7">
            <h2 className="mb-4 text-lg font-semibold text-[#5f3d2e]">
              {form.id ? '编辑代理' : '新增代理'}
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Agent Name</label>
                <input
                  value={form.agent_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, agent_name: e.target.value }))}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                  placeholder="例如：247"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Agent Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                  placeholder="例如：247 / YN / XY"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Display Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                  placeholder="例如：Xin Yi"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                  placeholder="例如：247 / yn / xy"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Order Prefix</label>
                <input
                  value={form.order_prefix}
                  onChange={(e) => setForm((prev) => ({ ...prev, order_prefix: e.target.value }))}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                  placeholder="例如：247 / YN"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Order Counter</label>
                <input
                  type="number"
                  min="1"
                  value={form.order_counter}
                  onChange={(e) => setForm((prev) => ({ ...prev, order_counter: e.target.value }))}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-[#7b5a49] md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>

            <div className="mt-5 rounded-2xl bg-[#f8f1ea] p-4 text-sm text-[#7b5a49]">
              <div>
                专属链接：
                <span className="ml-2 font-medium break-all text-[#5f3d2e]">
                  {siteUrl ? `${siteUrl}/order/${makeSlug(form.slug || form.code || '')}` : `/order/${makeSlug(form.slug || form.code || '')}`}
                </span>
              </div>
              <div className="mt-2">
                自取预览：
                <span className="ml-2 font-medium text-[#5f3d2e]">
                  {(normalizeText(form.order_prefix || form.code) || 'AGENT').toUpperCase()}-
                  {String(Number(form.order_counter || 1)).padStart(4, '0')}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveAgent}
                disabled={saving}
                className="rounded-2xl bg-[#6f4b3e] px-5 py-3 text-white transition hover:bg-[#5f3d2e] disabled:opacity-50"
              >
                {saving ? 'Saving...' : form.id ? 'Update Agent' : 'Create Agent'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-2xl border border-[#d9c3ae] bg-white px-5 py-3 text-[#5f3d2e] disabled:opacity-50"
              >
                Reset
              </button>

              {form.id ? (
                <button
                  type="button"
                  onClick={deleteAgent}
                  disabled={saving}
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}