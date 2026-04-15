'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
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

function getDisplayCustomerName(order) {
  return (
    order.customer_name ||
    order.recipient_name ||
    order.name ||
    '-'
  )
}

function getDisplayCustomerPhone(order) {
  return (
    order.customer_phone ||
    order.recipient_phone ||
    order.phone ||
    '-'
  )
}

function getDisplayAddress(order) {
  return (
    order.recipient_address ||
    order.address ||
    '-'
  )
}

function getDisplayShippingFee(order) {
  return order.delivery_fee ?? order.shipping_fee ?? 0
}

function getDisplaySubtotal(order, items) {
  if (order.subtotal !== undefined && order.subtotal !== null) {
    return Number(order.subtotal || 0)
  }

  return items.reduce((sum, item) => {
    return sum + Number(item.subtotal || 0)
  }, 0)
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const orderId = params?.id

  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (!orderId) return
    fetchOrderDetail()
  }, [orderId])

  async function fetchOrderDetail() {
    try {
      setLoading(true)
      setMessage('')

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError

      const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })

      if (itemError) throw itemError

      setOrder(orderData || null)
      setItems(Array.isArray(itemData) ? itemData : [])
    } catch (error) {
      console.error(error)
      setMessage(error.message || '读取订单明细失败')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(nextStatus) {
    if (!order) return

    try {
      setUpdatingStatus(true)
      setMessage('')

      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', order.id)

      if (error) throw error

      setOrder((prev) => (prev ? { ...prev, status: nextStatus } : prev))
      setMessage('订单状态已更新')
    } catch (error) {
      console.error(error)
      setMessage(error.message || '更新状态失败')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const subtotal = useMemo(() => {
    return getDisplaySubtotal(order || {}, items)
  }, [order, items])

  const shippingFee = useMemo(() => {
    return Number(getDisplayShippingFee(order || {}) || 0)
  }, [order])

  const totalAmount = useMemo(() => {
    if (!order) return 0
    if (order.total_amount !== undefined && order.total_amount !== null) {
      return Number(order.total_amount || 0)
    }
    return subtotal + shippingFee
  }, [order, subtotal, shippingFee])

  const groupedBundleItems = useMemo(() => {
    const groups = {}
    const normalItems = []

    for (const item of items) {
      if (String(item.item_type || '').toUpperCase() === 'BUNDLE_ITEM') {
        const key =
          item.bundle_group_key ||
          item.bundle_rule_id ||
          item.bundle_name ||
          'bundle'

        if (!groups[key]) {
          groups[key] = {
            key,
            bundle_name: item.bundle_name || 'Bundle',
            bundle_rule_id: item.bundle_rule_id || null,
            items: [],
          }
        }

        groups[key].items.push(item)
      } else {
        normalItems.push(item)
      }
    }

    return {
      normalItems,
      bundleGroups: Object.values(groups),
    }
  }, [items])

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f7efe7',
          padding: 24,
          color: '#6f4e37',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={boxStyle}>读取中...</div>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f7efe7',
          padding: 24,
          color: '#6f4e37',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={boxStyle}>
            <div style={{ marginBottom: 16, fontWeight: 800 }}>找不到这张订单</div>
            <Link href="/admin/orders" style={secondaryLinkStyle}>
              返回订单列表
            </Link>
          </div>
        </div>
      </main>
    )
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
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
            <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>订单明细</h1>
            <div style={{ marginTop: 8, color: '#8a6a54', fontSize: 14 }}>
              订单号：{order.order_no || order.pickup_order_id || order.id}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/admin/orders" style={secondaryLinkStyle}>
              返回订单列表
            </Link>
            <button type="button" onClick={fetchOrderDetail} style={primaryButton}>
              刷新明细
            </button>
          </div>
        </div>

        {message && <div style={messageStyle}>{message}</div>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section style={boxStyle}>
              <div style={sectionTitleStyle}>订单资料</div>

              <div style={infoGridStyle}>
                <InfoRow label="订单号" value={order.order_no || '-'} />
                <InfoRow label="自取单号" value={order.pickup_order_id || '-'} />
                <InfoRow label="下单时间" value={formatDateTime(order.created_at)} />
                <InfoRow label="订单状态" value={<StatusBadge status={order.status} />} />
                <InfoRow label="配送方式" value={order.delivery_method || '-'} />
                <InfoRow label="代理" value={order.agent_name || '-'} />
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={subTitleStyle}>快速改状态</div>
                <select
                  value={order.status || 'pending'}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={updatingStatus}
                  style={{
                    ...inputStyle,
                    maxWidth: 240,
                    marginTop: 8,
                  }}
                >
                  <option value="pending">pending</option>
                  <option value="confirmed">confirmed</option>
                  <option value="ready">ready</option>
                  <option value="done">done</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
            </section>

            <section style={boxStyle}>
              <div style={sectionTitleStyle}>客户 / 收件资料</div>

              <div style={infoGridStyle}>
                <InfoRow label="名字" value={getDisplayCustomerName(order)} />
                <InfoRow label="电话" value={getDisplayCustomerPhone(order)} />
                <InfoRow label="地址" value={getDisplayAddress(order)} />
                <InfoRow label="Postcode" value={order.postcode || '-'} />
                <InfoRow label="州属" value={order.state || '-'} />
                <InfoRow label="配送区域" value={order.shipping_region || '-'} />
              </div>
            </section>

            <section style={boxStyle}>
              <div style={sectionTitleStyle}>时间资料</div>

              <div style={infoGridStyle}>
                <InfoRow label="自取日期" value={order.pickup_date || '-'} />
                <InfoRow label="自取时间" value={order.pickup_time || '-'} />
                <InfoRow label="备注" value={order.notes || order.remark || '-'} />
              </div>
            </section>

            <section style={boxStyle}>
              <div style={sectionTitleStyle}>订单商品</div>

              {groupedBundleItems.normalItems.length === 0 &&
              groupedBundleItems.bundleGroups.length === 0 ? (
                <div>这张订单没有商品明细</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {groupedBundleItems.normalItems.length > 0 && (
                    <div>
                      <div style={subTitleStyle}>普通商品</div>
                      <div style={{ overflowX: 'auto', marginTop: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>产品名</th>
                              <th style={thStyle}>类型</th>
                              <th style={thStyle}>数量</th>
                              <th style={thStyle}>单价</th>
                              <th style={thStyle}>小计</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedBundleItems.normalItems.map((item) => (
                              <tr key={item.id}>
                                <td style={tdStyle}>{item.product_name || '-'}</td>
                                <td style={tdStyle}>{item.item_type || 'PRODUCT'}</td>
                                <td style={tdStyle}>{item.qty || 0}</td>
                                <td style={tdStyle}>{formatMoney(item.unit_price)}</td>
                                <td style={tdStyle}>{formatMoney(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {groupedBundleItems.bundleGroups.map((group) => (
                    <div
                      key={group.key}
                      style={{
                        border: '1px solid #ead7c4',
                        borderRadius: 16,
                        background: '#fff8f1',
                        padding: 16,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
                        Bundle：{group.bundle_name}
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>产品名</th>
                              <th style={thStyle}>类型</th>
                              <th style={thStyle}>数量</th>
                              <th style={thStyle}>单价</th>
                              <th style={thStyle}>小计</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item) => (
                              <tr key={item.id}>
                                <td style={tdStyle}>{item.product_name || '-'}</td>
                                <td style={tdStyle}>{item.item_type || 'BUNDLE_ITEM'}</td>
                                <td style={tdStyle}>{item.qty || 0}</td>
                                <td style={tdStyle}>{formatMoney(item.unit_price)}</td>
                                <td style={tdStyle}>{formatMoney(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section style={boxStyle}>
              <div style={sectionTitleStyle}>金额汇总</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SummaryRow label="商品小计" value={formatMoney(subtotal)} />
                <SummaryRow label="运费" value={formatMoney(shippingFee)} />
                <div
                  style={{
                    borderTop: '1px solid #ead7c4',
                    paddingTop: 12,
                    marginTop: 4,
                  }}
                >
                  <SummaryRow
                    label="总额"
                    value={formatMoney(totalAmount)}
                    bold
                  />
                </div>
              </div>
            </section>

            <section style={boxStyle}>
              <div style={sectionTitleStyle}>系统字段</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InfoRow label="Order ID" value={order.id} />
                <InfoRow label="created_at" value={formatDateTime(order.created_at)} />
                <InfoRow label="updated_at" value={formatDateTime(order.updated_at)} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: 12,
        alignItems: 'start',
      }}
    >
      <div style={{ color: '#8a6a54', fontWeight: 700 }}>{label}</div>
      <div style={{ color: '#6f4e37', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function SummaryRow({ label, value, bold = false }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        fontWeight: bold ? 900 : 700,
        fontSize: bold ? 18 : 15,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

const boxStyle = {
  background: '#fffaf5',
  border: '1px solid #ead7c4',
  borderRadius: 20,
  padding: 20,
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

const sectionTitleStyle = {
  fontSize: 20,
  fontWeight: 900,
  marginBottom: 16,
}

const subTitleStyle = {
  fontSize: 15,
  fontWeight: 800,
  color: '#7b5a49',
}

const infoGridStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
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