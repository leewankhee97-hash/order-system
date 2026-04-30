'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function formatMoney(value) {
  return `RM ${Number(value || 0).toFixed(2)}`
}

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

function getStatusStyle(status) {
  const s = String(status || '').toLowerCase()

  if (s === 'pending') {
    return {
      color: '#a16207',
      background: '#fffbeb',
      border: '#fde68a',
      label: 'PENDING',
    }
  }

  if (s === 'confirmed') {
    return {
      color: '#1d4ed8',
      background: '#eff6ff',
      border: '#bfdbfe',
      label: 'CONFIRMED',
    }
  }

  if (s === 'ready') {
    return {
      color: '#0f766e',
      background: '#ecfeff',
      border: '#99f6e4',
      label: 'READY',
    }
  }

  if (s === 'done') {
    return {
      color: '#166534',
      background: '#f0fdf4',
      border: '#bbf7d0',
      label: 'DONE',
    }
  }

  if (s === 'cancelled') {
    return {
      color: '#b91c1c',
      background: '#fff1f2',
      border: '#fecdd3',
      label: 'CANCELLED',
    }
  }

  return {
    color: '#6f4e37',
    background: '#f8f0e8',
    border: '#d8b99d',
    label: status || 'UNKNOWN',
  }
}

function StatusBadge({ status }) {
  const style = getStatusStyle(status)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 30,
        padding: '0 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        color: style.color,
        background: style.background,
        border: `1px solid ${style.border}`,
      }}
    >
      {style.label}
    </span>
  )
}

function getAgentSlug(agent) {
  return agent?.agent_slug || agent?.slug || ''
}

function getAgentName(agent) {
  return agent?.agent_name || agent?.name || '-'
}

function findOrderAgent(order, agents) {
  return agents.find((agent) => {
    const orderAgentId = String(order.agent_id || '').trim()
    const agentId = String(agent.id || '').trim()

    const orderAgentSlug = String(order.agent_slug || order.slug || '')
      .trim()
      .toLowerCase()

    const agentSlug = String(getAgentSlug(agent) || '')
      .trim()
      .toLowerCase()

    return (
      (orderAgentId && agentId && orderAgentId === agentId) ||
      (orderAgentSlug && agentSlug && orderAgentSlug === agentSlug)
    )
  })
}

function AdminOrdersContent() {
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deliveryFilter, setDeliveryFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    fetchOrders()
    fetchAgents()
  }, [])

  useEffect(() => {
    const agentFromUrl = searchParams.get('agent')
    if (agentFromUrl) {
      setAgentFilter(agentFromUrl)
    }
  }, [searchParams])

  async function fetchAgents() {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setMessage(error.message || '读取代理失败')
    }
  }

  async function fetchOrders() {
    try {
      setLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setMessage(error.message || '读取订单失败')
    } finally {
      setLoading(false)
    }
  }

  async function refreshAll() {
    await Promise.all([fetchOrders(), fetchAgents()])
  }

  async function updateStatus(orderId, nextStatus) {
    try {
      setUpdatingId(orderId)
      setMessage('')

      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)

      if (error) throw error

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: nextStatus } : order
        )
      )

      setMessage('订单状态已更新')
    } catch (error) {
      console.error(error)
      setMessage(error.message || '更新状态失败')
    } finally {
      setUpdatingId('')
    }
  }

  async function restoreStockForOrder(orderId) {
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    if (itemsError) throw itemsError

    const productQtyMap = {}

    for (const item of items || []) {
      if (item.item_type === 'product' && item.product_id) {
        productQtyMap[item.product_id] =
          (productQtyMap[item.product_id] || 0) + Number(item.qty || 0)
      }

      if (item.item_type === 'bundle') {
        const meta = item.meta || {}
        const bundleItems = Array.isArray(meta.items) ? meta.items : []

        for (const sub of bundleItems) {
          if (!sub?.product_id) continue

          productQtyMap[sub.product_id] =
            (productQtyMap[sub.product_id] || 0) + Number(sub.qty || 0)
        }
      }
    }

    const productIds = Object.keys(productQtyMap)
    if (productIds.length === 0) return

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, stock')
      .in('id', productIds)

    if (productsError) throw productsError

    for (const product of products || []) {
      if (product.stock === undefined || product.stock === null) continue

      const restoreQty = Number(productQtyMap[product.id] || 0)
      const nextStock = Number(product.stock || 0) + restoreQty

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: nextStock })
        .eq('id', product.id)

      if (updateError) throw updateError
    }
  }

  async function deleteOrder(orderId, orderNo) {
    const ok = window.confirm(
      `确定删除订单 ${orderNo || ''}？\n\n会同时：\n1. 删除 order_items\n2. 删除 orders\n3. 自动回补库存`
    )

    if (!ok) return

    try {
      setDeletingId(orderId)
      setMessage('')

      await restoreStockForOrder(orderId)

      const { error: deleteItemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)

      if (deleteItemsError) throw deleteItemsError

      const { error: deleteOrderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (deleteOrderError) throw deleteOrderError

      setOrders((prev) => prev.filter((order) => order.id !== orderId))
      setMessage(`订单 ${orderNo || ''} 已删除，库存已回补`)
    } catch (error) {
      console.error(error)
      setMessage(error.message || '删除订单失败')
    } finally {
      setDeletingId('')
    }
  }

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return orders.filter((order) => {
      const agent = findOrderAgent(order, agents)
      const agentName = getAgentName(agent)
      const agentSlug = getAgentSlug(agent)

      const matchesKeyword =
        !keyword ||
        [
          order.order_no,
          order.customer_name,
          order.customer_phone,
          order.delivery_method,
          order.status,
          order.notes,
          agentName,
          agentSlug,
          order.agent_id,
          order.agent_slug,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      const matchesStatus =
        statusFilter === 'all' || String(order.status || '') === statusFilter

      const matchesDelivery =
        deliveryFilter === 'all' ||
        String(order.delivery_method || '') === deliveryFilter

      const matchesAgent =
        agentFilter === 'all' ||
        String(order.agent_id || '') === String(agentFilter) ||
        String(agent?.id || '') === String(agentFilter) ||
        String(order.agent_slug || '').toLowerCase() ===
          String(agentFilter).toLowerCase() ||
        String(agentSlug || '').toLowerCase() ===
          String(agentFilter).toLowerCase()

      return matchesKeyword && matchesStatus && matchesDelivery && matchesAgent
    })
  }, [orders, agents, search, statusFilter, deliveryFilter, agentFilter])

  const activeAgent = agents.find((a) => String(a.id) === String(agentFilter))

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7efe7',
        padding: 24,
        color: '#6f4e37',
      }}
    >
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
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
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>订单后台</h1>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/admin" style={secondaryLinkStyle}>
              返回后台首页
            </Link>

            <button type="button" onClick={refreshAll} style={primaryButton}>
              刷新订单
            </button>
          </div>
        </div>

        <div style={boxStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <input
              placeholder="搜索单号 / 客户 / 电话 / 配送方式 / 状态 / 代理"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">全部状态</option>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="ready">ready</option>
              <option value="done">done</option>
              <option value="cancelled">cancelled</option>
            </select>

            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">全部配送方式</option>
              <option value="邮寄">邮寄</option>
              <option value="自取">自取</option>
              <option value="Lalamove">Lalamove</option>
              <option value="LALAMOVE">LALAMOVE</option>
            </select>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">全部代理</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {getAgentName(agent)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {agentFilter !== 'all' ? (
          <div style={activeFilterStyle}>
            当前查看代理订单：
            <strong style={{ marginLeft: 6 }}>{getAgentName(activeAgent)}</strong>

            <button
              type="button"
              onClick={() => setAgentFilter('all')}
              style={clearFilterButton}
            >
              查看全部订单
            </button>
          </div>
        ) : null}

        {message && <div style={messageStyle}>{message}</div>}

        <div style={boxStyle}>
          {loading ? (
            <div>读取中...</div>
          ) : filteredOrders.length === 0 ? (
            <div>没有找到订单</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 1450,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>下单时间</th>
                    <th style={thStyle}>订单号</th>
                    <th style={thStyle}>代理</th>
                    <th style={thStyle}>客户</th>
                    <th style={thStyle}>电话</th>
                    <th style={thStyle}>配送方式</th>
                    <th style={thStyle}>小计</th>
                    <th style={thStyle}>运费</th>
                    <th style={thStyle}>总额</th>
                    <th style={thStyle}>状态</th>
                    <th style={thStyle}>快速改状态</th>
                    <th style={thStyle}>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => {
                    const agent = findOrderAgent(order, agents)

                    return (
                      <tr key={order.id}>
                        <td style={tdStyle}>{formatDateTime(order.created_at)}</td>

                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800 }}>
                            {order.order_no || '-'}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800 }}>
                            {getAgentName(agent)}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: '#8a6a54',
                              marginTop: 3,
                            }}
                          >
                            {getAgentSlug(agent) ||
                              order.agent_slug ||
                              order.agent_id ||
                              '-'}
                          </div>
                        </td>

                        <td style={tdStyle}>{order.customer_name || '-'}</td>
                        <td style={tdStyle}>{order.customer_phone || '-'}</td>
                        <td style={tdStyle}>{order.delivery_method || '-'}</td>
                        <td style={tdStyle}>{formatMoney(order.subtotal)}</td>
                        <td style={tdStyle}>{formatMoney(order.delivery_fee)}</td>

                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800 }}>
                            {formatMoney(order.total_amount)}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <StatusBadge status={order.status} />
                        </td>

                        <td style={tdStyle}>
                          <select
                            value={order.status || 'pending'}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            disabled={updatingId === order.id || deletingId === order.id}
                            style={{
                              ...inputStyle,
                              height: 38,
                              minWidth: 140,
                            }}
                          >
                            <option value="pending">pending</option>
                            <option value="confirmed">confirmed</option>
                            <option value="ready">ready</option>
                            <option value="done">done</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Link
                              href={`/admin/orders/${order.id}`}
                              style={smallPrimaryLinkStyle}
                            >
                              查看明细
                            </Link>

                            <button
                              type="button"
                              onClick={() => deleteOrder(order.id, order.order_no)}
                              disabled={deletingId === order.id}
                              style={{
                                ...smallDangerButton,
                                opacity: deletingId === order.id ? 0.6 : 1,
                                cursor:
                                  deletingId === order.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {deletingId === order.id ? '删除中...' : '删除订单'}
                            </button>
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

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>读取中...</div>}>
      <AdminOrdersContent />
    </Suspense>
  )
}

const boxStyle = {
  background: '#fffaf5',
  border: '1px solid #ead7c4',
  borderRadius: 20,
  padding: 20,
  marginBottom: 20,
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

const smallPrimaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #a47c57',
  background: '#a47c57',
  color: '#fff',
  fontWeight: 700,
  textDecoration: 'none',
}

const smallDangerButton = {
  height: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #d9a0a0',
  background: '#fff4f4',
  color: '#a14f4f',
  fontWeight: 700,
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

const activeFilterStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 14,
  background: '#fff8f1',
  border: '1px solid #ead7c4',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const clearFilterButton = {
  height: 32,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #d7bfa8',
  background: '#fff',
  color: '#6f4e37',
  fontWeight: 800,
  cursor: 'pointer',
} 