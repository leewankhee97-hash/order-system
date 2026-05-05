'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [agents, setAgents] = useState([])

  const [todaySales, setTodaySales] = useState(0)
  const [monthSales, setMonthSales] = useState(0)
  const [todayProfit, setTodayProfit] = useState(0)
const [monthProfit, setMonthProfit] = useState(0)
  const [agentRanking, setAgentRanking] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [insights, setInsights] = useState([])

  const [lowStock, setLowStock] = useState([])
  const [outStock, setOutStock] = useState([])
  const [groupedOutStock, setGroupedOutStock] = useState({})
  const [groupedLowStock, setGroupedLowStock] = useState({})

  const [stockInputs, setStockInputs] = useState({})
  const [costInputs, setCostInputs] = useState({})
  const [savingId, setSavingId] = useState(null)
const [batchSavingKey, setBatchSavingKey] = useState(null)
const [saveMsg, setSaveMsg] = useState('')
  const [collapsedOut, setCollapsedOut] = useState({})
  const [collapsedLow, setCollapsedLow] = useState({})

  const [resetAgentId, setResetAgentId] = useState('')
  const [toast, setToast] = useState(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth <= 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    init()
  }, [selectedMonth])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  async function init() {
    const { data: orderData } = await supabase.from('orders').select('*')
    const { data: productData } = await supabase.from('products').select('*')
    const { data: agentData } = await supabase
      .from('agents')
      .select('id, name, code, slug, order_counter')
      .order('name', { ascending: true })

    const { data: orderItemData } = await supabase.from('order_items').select('*')

    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    const o = orderData || []
    const p = productData || []
    const oi = orderItemData || []

    setOrders(o)
    setProducts(p)
    setAgents(agentData || [])
    setNotifications(notifData || [])

    calculateStats(o, p, oi)
  }

  function generateInsights(current, previous, topProducts, agentRanking) {
    const result = []

    if (previous.monthSales > 0) {
      const diff = current.monthSales - previous.monthSales
      const percent = ((diff / previous.monthSales) * 100).toFixed(0)

      if (diff > 0) result.push(`📈 本月销售比上月 +${percent}%`)
      else if (diff < 0) result.push(`📉 本月销售比上月 ${percent}%`)
      else result.push('➖ 本月销售与上月持平')
    }

    if (topProducts.length > 0) {
      const topList = topProducts.slice(0, 3)

      topList.forEach((p, i) => {
        const label = [p.category, p.brand, p.name]
          .filter((v) => v && v !== '-' && v !== '未分类')
          .join(' ｜ ')

        result.push(`🔥 爆款 #${i + 1}：${label || p.name || 'UNKNOWN'}（销量 ${Number(p.qty || 0)}）`)
      })

      result.push('👉 建议：优先补货 + 推广爆款')
    }

    const profitable = topProducts
      .filter((p) => Number(p.profit || 0) > 0)
      .sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0))[0]

    if (profitable) {
      const label = [profitable.brand, profitable.name].filter(Boolean).join(' ')
      result.push(`💰 利润最高：${label}（RM ${Number(profitable.profit || 0).toFixed(2)}）`)
    }

    if (agentRanking.length >= 2) {
  const totalSales = agentRanking.reduce((sum, a) => sum + Number(a.total || 0), 0)
  const avgSales = totalSales / agentRanking.length
  const weakAgents = agentRanking.filter((a) => {
    return Number(a.total || 0) < avgSales * 0.5 && Number(a.count || 0) < 3
  })

  if (weakAgents.length > 0) {
    weakAgents.slice(0, 3).forEach((agent) => {
      result.push(
        `⚠️ ${agent.name} 表现偏低：销售 RM ${Number(agent.total || 0).toFixed(2)}，订单 ${agent.count} 单，建议跟进`
      )
    })
  }
}

    return result
  }

  function getNetSales(order) {
    const total = Number(order.total_amount || 0)
    const shipping = Number(order.shipping_fee || 0)
    const lalamove = Number(order.lalamove_fee || 0)
    return total - shipping - lalamove
  }

  function groupProducts(items) {
    const grouped = {}

    items.forEach((p) => {
      const category = String(p.category || p.product_type || '未分类').trim()
      const brand = String(p.series || p.brand || '其他').trim()

      if (!grouped[category]) grouped[category] = {}
      if (!grouped[category][brand]) grouped[category][brand] = []

      grouped[category][brand].push(p)
    })

    return grouped
  }

  function buildCollapsedState(grouped, prevState = {}) {
    const next = { ...prevState }

    Object.keys(grouped).forEach((category) => {
      if (typeof next[category] === 'undefined') next[category] = false
    })

    return next
  }

  function getItemPrice(item, info, qty) {
    const directPrice = Number(
      item.price ||
      item.unit_price ||
      item.product_price ||
      item.sell_price ||
      0
    )

    if (directPrice > 0) return directPrice

    const subtotal = Number(item.subtotal || item.total || item.amount || 0)
    if (subtotal > 0 && qty > 0) return subtotal / qty

    return Number(info.price || 0)
  }

  function calculateStats(orders, products, orderItems = []) {
    const today = new Date().toISOString().slice(0, 10)
    const [year, month] = selectedMonth.split('-').map(Number)

    let todayTotal = 0
let monthTotal = 0
let todayProfitTotal = 0
let monthProfitTotal = 0
    const agentMap = {}

    orders.forEach((o) => {
      const sales = getNetSales(o)
      const d = new Date(o.created_at)

      const isThisMonth =
        !Number.isNaN(d.getTime()) &&
        d.getMonth() + 1 === month &&
        d.getFullYear() === year

      if (o.created_at?.slice(0, 10) === today) {
        todayTotal += sales
      }

      if (isThisMonth) {
        monthTotal += sales

        const name = String(o.agent_name || 'UNKNOWN').trim() || 'UNKNOWN'

        if (!agentMap[name]) agentMap[name] = { name, total: 0, count: 0 }

        agentMap[name].total += sales
        agentMap[name].count += 1
      }
    })

    const ranking = Object.values(agentMap)
      .map((agent) => ({
        ...agent,
        avg: agent.count > 0 ? agent.total / agent.count : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const low = products.filter((p) => {
      const stock = Number(p.stock || 0)
      return stock > 0 && stock <= 50
    })

    const out = products.filter((p) => Number(p.stock || 0) <= 0)

    const groupedOut = groupProducts(out)
    const groupedLow = groupProducts(low)

    const orderDateMap = {}
    orders.forEach((o) => {
      orderDateMap[o.id] = o.created_at
    })

    const productInfoMap = {}
    products.forEach((p) => {
      productInfoMap[String(p.id)] = {
        category: p.category || p.product_type || '未分类',
        brand: p.brand || p.series || '-',
        name: p.name || '-',
        cost: Number(p.cost || p.cost_price || 0),
        price: Number(p.price || p.price_1 || p.price_2 || p.price_3 || 0),
      }
    })

    const productMap = {}

    orderItems.forEach((item) => {
  const createdAt = orderDateMap[item.order_id]
  const d = new Date(createdAt)

  // ✅ 正确判断月份
  if (
    Number.isNaN(d.getTime()) ||
    d.getMonth() + 1 !== month ||
    d.getFullYear() !== year
  ) {
    return
  }

  const info = productInfoMap[String(item.product_id)] || {}

  const category = info.category || '未分类'
  const brand = info.brand || '-'
  const name = item.product_name || info.name || 'UNKNOWN'

  const qty = Number(item.qty || item.quantity || 0)
  const price = getItemPrice(item, info, qty)
  const cost = Number(info.cost || 0)

  // ✅ 利润计算
  const itemProfit = (price - cost) * qty

  const orderDay = createdAt?.slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  if (orderDay === todayStr) {
    todayProfitTotal += itemProfit
  }

  monthProfitTotal += itemProfit

  const key = `${category}__${brand}__${name}`

  if (!productMap[key]) {
    productMap[key] = {
      category,
      brand,
      name,
      qty: 0,
      sales: 0,
      profit: 0,
    }
  }

  productMap[key].qty += qty
  productMap[key].sales += price * qty
  productMap[key].profit += itemProfit
})

    const top = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)

    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year

    let prevMonthSales = 0

    orders.forEach((o) => {
      const d = new Date(o.created_at)

      if (
        !Number.isNaN(d.getTime()) &&
        d.getMonth() + 1 === prevMonth &&
        d.getFullYear() === prevYear
      ) {
        prevMonthSales += getNetSales(o)
      }
    })

    const ai = generateInsights(
      { monthSales: monthTotal },
      { monthSales: prevMonthSales },
      top,
      ranking
    )

    setTodaySales(todayTotal)
setMonthSales(monthTotal)
setTodayProfit(todayProfitTotal)
setMonthProfit(monthProfitTotal)
    setAgentRanking(ranking)
    setLowStock(low)
    setOutStock(out)
    setGroupedOutStock(groupedOut)
    setGroupedLowStock(groupedLow)
    setTopProducts(top)
    setInsights(ai)

    setCollapsedOut((prev) => buildCollapsedState(groupedOut, prev))
    setCollapsedLow((prev) => buildCollapsedState(groupedLow, prev))
  }

  function handleStockInput(productId, value) {
    setStockInputs((prev) => ({
      ...prev,
      [productId]: value,
    }))
  }
function handleCostInput(productId, value) {
  setCostInputs((prev) => ({
    ...prev,
    [productId]: value,
  }))
}

async function saveCost(productId) {
  const raw = costInputs[productId]
  const newCost = Number(raw)

  if (raw === undefined || raw === '' || Number.isNaN(newCost) || newCost < 0) {
    setToast({ type: 'error', msg: '请输入正确成本' })
    return
  }

  setSavingId(productId)
  setSaveMsg('')

  const { error } = await supabase
    .from('products')
    .update({ cost: newCost })
    .eq('id', productId)

  if (error) {
    setToast({ type: 'error', msg: `成本更新失败：${error.message}` })
    setSavingId(null)
    return
  }

  setSaveMsg('成本已更新')
  setToast({ type: 'success', msg: '成本已更新 ✅' })

  setCostInputs((prev) => ({
    ...prev,
    [productId]: '',
  }))

  await init()
  setSavingId(null)

  setTimeout(() => setSaveMsg(''), 1800)
}
  async function saveStock(productId) {
    function hasProductPendingChanges(productId) {
  const stockRaw = stockInputs[productId]
  const costRaw = costInputs[productId]

  const hasStock =
    stockRaw !== undefined &&
    stockRaw !== null &&
    String(stockRaw).trim() !== ''

  const hasCost =
    costRaw !== undefined &&
    costRaw !== null &&
    String(costRaw).trim() !== ''

  return hasStock || hasCost
}

function buildProductUpdatePayload(productId) {
  const payload = {}

  const stockRaw = stockInputs[productId]
  const costRaw = costInputs[productId]

  if (
    stockRaw !== undefined &&
    stockRaw !== null &&
    String(stockRaw).trim() !== ''
  ) {
    const newStock = Number(stockRaw)

    if (Number.isNaN(newStock) || newStock < 0) {
      throw new Error('库存必须是 0 或以上')
    }

    payload.stock = newStock
  }

  if (
    costRaw !== undefined &&
    costRaw !== null &&
    String(costRaw).trim() !== ''
  ) {
    const newCost = Number(costRaw)

    if (Number.isNaN(newCost) || newCost < 0) {
      throw new Error('成本必须是 0 或以上')
    }

    payload.cost = newCost
  }

  return payload
}

async function saveSeriesProducts(items = [], label = '此系列', saveKey = '') {
  const changedItems = items.filter((p) => hasProductPendingChanges(p.id))

  if (changedItems.length === 0) {
    setToast({ type: 'error', msg: '这个系列还没有填写任何更改' })
    return
  }

  const ok = confirm(`确定保存【${label}】的 ${changedItems.length} 个产品更改？`)
  if (!ok) return

  setBatchSavingKey(saveKey)
  setSaveMsg('')

  try {
    for (const p of changedItems) {
      const payload = buildProductUpdatePayload(p.id)

      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', p.id)

      if (error) {
        throw new Error(`${p.name || p.id} 保存失败：${error.message}`)
      }
    }

    setToast({
      type: 'success',
      msg: `【${label}】已成功保存 ${changedItems.length} 个产品 ✅`,
    })

    setSaveMsg('修改成功')

    setStockInputs((prev) => {
      const next = { ...prev }
      changedItems.forEach((p) => {
        delete next[p.id]
      })
      return next
    })

    setCostInputs((prev) => {
      const next = { ...prev }
      changedItems.forEach((p) => {
        delete next[p.id]
      })
      return next
    })

    await init()

    setTimeout(() => setSaveMsg(''), 1800)
  } catch (err) {
    setToast({
      type: 'error',
      msg: err?.message || '批量保存失败',
    })
  } finally {
    setBatchSavingKey(null)
  }
}
    const raw = stockInputs[productId]
    const newStock = Number(raw)

    if (raw === undefined || raw === '' || Number.isNaN(newStock) || newStock < 0) {
      setToast({ type: 'error', msg: '请输入正确库存' })
      return
    }

    setSavingId(productId)
    setSaveMsg('')

    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId)

    if (error) {
      setToast({ type: 'error', msg: `更新失败：${error.message}` })
      setSavingId(null)
      return
    }

    setSaveMsg('库存已更新')
    setToast({ type: 'success', msg: '库存已更新 ✅' })

    setStockInputs((prev) => ({
      ...prev,
      [productId]: '',
    }))

    await init()
    setSavingId(null)

    setTimeout(() => setSaveMsg(''), 1800)
  }

  async function markNotificationRead(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) {
      setToast({ type: 'error', msg: `通知更新失败：${error.message}` })
      return
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    setToast({ type: 'success', msg: '通知已处理 ✅' })
  }

  async function handleResetAgent() {
    if (!resetAgentId) {
      setToast({ type: 'error', msg: '请选择 Agent' })
      return
    }

    if (resetLoading) return

    const selected = agents.find((a) => String(a.id) === String(resetAgentId))
    const label = selected?.name || selected?.code || selected?.slug || resetAgentId

    const ok = confirm(`确定要清空 ${label} 所有订单并重置 ORDER ID？`)
    if (!ok) return

    setResetLoading(true)

    try {
      const res = await fetch('/api/reset-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: resetAgentId }),
      })

      const text = await res.text()

      if (res.ok) {
        setToast({ type: 'success', msg: `${label} 已成功重置 ✅` })
        await init()
        setResetAgentId('')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setToast({ type: 'error', msg: `失败：${text}` })
      }
    } catch (err) {
      setToast({ type: 'error', msg: '网络错误' })
    } finally {
      setResetLoading(false)
    }
  }

  function quickFill(productId, qty) {
    setStockInputs((prev) => ({
      ...prev,
      [productId]: String(qty),
    }))
  }

  function toggleCollapse(type, category) {
    if (type === 'out') {
      setCollapsedOut((prev) => ({
        ...prev,
        [category]: !prev[category],
      }))
      return
    }

    setCollapsedLow((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  function getCategoryCount(brands) {
    return Object.values(brands).reduce((sum, items) => sum + items.length, 0)
  }

  function getRankBadge(index) {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  function getRankCardStyle(index) {
    if (index === 0) return { background: '#fff7e6', border: '1px solid #ecd8a6' }
    if (index === 1) return { background: '#f8f8f8', border: '1px solid #dddddd' }
    if (index === 2) return { background: '#fff4ee', border: '1px solid #e7c7b5' }
    return { background: '#fff', border: '1px solid #ead8c8' }
  }

  const pageWrap = {
    width: '100%',
    maxWidth: isMobile ? '100%' : 1280,
    margin: '0 auto',
    padding: isMobile ? '10px 8px 24px' : '0 0 40px',
    minWidth: 0,
    fontSize: isMobile ? 13 : 14,
  }

  const statCard = {
    padding: isMobile ? '12px 12px' : '20px',
    borderRadius: isMobile ? '14px' : '18px',
    border: '1px solid #d7bfa8',
    background: '#fff',
    minWidth: 0,
  }

  const sectionCard = {
    padding: isMobile ? '12px' : '20px',
    borderRadius: isMobile ? '14px' : '18px',
    border: '1px solid #d7bfa8',
    background: '#fff',
    minWidth: 0,
  }

  const miniBtn = {
    padding: isMobile ? '6px 8px' : '6px 10px',
    borderRadius: '10px',
    border: '1px solid #d7bfa8',
    background: '#fffaf5',
    color: '#6f4e37',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: isMobile ? 12 : 13,
    minHeight: isMobile ? 32 : 34,
  }

  const saveBtn = {
    padding: isMobile ? '8px 10px' : '8px 14px',
    borderRadius: '10px',
    border: '1px solid #c89f7a',
    background: '#6f4e37',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: isMobile ? 12 : 13,
    minHeight: isMobile ? 34 : 36,
    width: isMobile ? '100%' : 'auto',
  }

  const categoryHeaderBtn = {
    border: '1px solid #d7bfa8',
    background: '#fff',
    color: '#6f4e37',
    padding: isMobile ? '7px 10px' : '8px 12px',
    borderRadius: 10,
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: isMobile ? 12 : 13,
  }

  const viewLinkStyle = {
    display: 'inline-block',
    padding: isMobile ? '7px 10px' : '8px 12px',
    borderRadius: 10,
    border: '1px solid #d7bfa8',
    background: '#fffaf5',
    color: '#6f4e37',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: isMobile ? 12 : 13,
  }

  const inputStyle = {
    width: isMobile ? '100%' : 100,
    padding: isMobile ? '8px 9px' : '8px 10px',
    borderRadius: 10,
    border: '1px solid #d7bfa8',
    outline: 'none',
    fontSize: isMobile ? 12 : 13,
    minHeight: 34,
    boxSizing: 'border-box',
  }

  function renderStockGroup(grouped, type = 'low') {
    const isOut = type === 'out'
    const collapsedMap = isOut ? collapsedOut : collapsedLow
    const stockParam = isOut ? 'out' : 'low'

    if (Object.keys(grouped).length === 0) {
      return <div>{isOut ? '暂无缺货' : '暂无低库存产品'}</div>
    }

    return Object.entries(grouped).map(([category, brands]) => {
      const totalCount = getCategoryCount(brands)
      const isCollapsed = !!collapsedMap[category]

      return (
        <div key={category} style={{ marginBottom: isMobile ? 12 : 20, border: '1px solid #ead8c8', borderRadius: isMobile ? 14 : 16, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: isMobile ? '10px 12px' : '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap', background: isOut ? '#fff1f1' : '#fff8ea', borderBottom: isCollapsed ? 'none' : '1px solid #f0e0d3' }}>
            <div>
              <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900 }}>{category}</div>
              <div style={{ fontSize: isMobile ? 12 : 14, opacity: 0.8, marginTop: 4 }}>
                共 {totalCount} 个产品
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={`/admin/products?stock=${stockParam}&category=${encodeURIComponent(category)}`} style={viewLinkStyle}>
                查看产品
              </a>

              <button type="button" style={categoryHeaderBtn} onClick={() => toggleCollapse(type, category)}>
                {isCollapsed ? '展开' : '收起'}
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <div style={{ padding: isMobile ? 10 : 14 }}>
              {Object.entries(brands).map(([brand, items]) => (
                <div key={brand} style={{ marginBottom: isMobile ? 10 : 12, padding: isMobile ? '10px' : '12px', borderRadius: '14px', background: isOut ? '#fff8f8' : '#fffdf6', border: '1px solid #ead8c8' }}>
                  {(() => {
  const seriesSaveKey = `${type}-${category}-${brand}`
  const pendingCount = items.filter((p) => hasProductPendingChanges(p.id)).length
  const isBatchSaving = batchSavingKey === seriesSaveKey

  return (
    <div
      style={{
        fontWeight: 900,
        marginBottom: 10,
        color: '#6f4e37',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <div>
        <div>{brand}</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          {items.length} 个产品
          {pendingCount > 0 ? ` ｜ 已修改 ${pendingCount} 个` : ''}
        </div>
      </div>

      <button
        type="button"
        disabled={isBatchSaving || pendingCount === 0}
        onClick={() => saveSeriesProducts(items, brand, seriesSaveKey)}
        style={{
          ...saveBtn,
          width: isMobile ? '100%' : 'auto',
          opacity: isBatchSaving || pendingCount === 0 ? 0.55 : 1,
          cursor: isBatchSaving || pendingCount === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {isBatchSaving ? '保存中...' : '保存此系列'}
      </button>
    </div>
  )
})()}

                  <div style={{ display: 'grid', gap: 10 }}>
                    {items.map((p) => (
                      <div key={p.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 1fr) 110px minmax(140px, 220px) auto', gap: isMobile ? 8 : 10, alignItems: 'center', padding: isMobile ? '10px' : '10px 12px', borderRadius: '12px', background: '#fff', border: '1px solid #f0e0d3' }}>
                        <div style={{ fontWeight: 700 }}>
  <div>{p.name}</div>
  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
    Cost: RM {Number(p.cost || 0).toFixed(2)}
  </div>
</div>

                        <div style={{ fontWeight: 800, color: isOut ? '#c0392b' : '#b9770e' }}>
                          stock: {Number(p.stock || 0)}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="输入库存"
                            value={stockInputs[p.id] ?? ''}
                            onChange={(e) => handleStockInput(p.id, e.target.value)}
                            style={inputStyle}
                          />
<input
  type="number"
  min="0"
  step="0.01"
  placeholder="成本"
  value={costInputs[p.id] ?? ''}
  onChange={(e) => handleCostInput(p.id, e.target.value)}
  style={inputStyle}
/>

<button
  type="button"
  style={miniBtn}
  onClick={() => saveCost(p.id)}
>
  存成本
</button>
                          <button type="button" style={miniBtn} onClick={() => quickFill(p.id, 10)}>10</button>
                          <button type="button" style={miniBtn} onClick={() => quickFill(p.id, 20)}>20</button>
                          <button type="button" style={miniBtn} onClick={() => quickFill(p.id, 50)}>50</button>
                        </div>

                        <div>
                          <button
                            type="button"
                            style={{ ...saveBtn, opacity: savingId === p.id ? 0.7 : 1 }}
                            disabled={savingId === p.id}
                            onClick={() => saveStock(p.id)}
                          >
                            {savingId === p.id ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 10 : 'auto', zIndex: 9999, padding: isMobile ? '10px 12px' : '12px 16px', borderRadius: 12, background: toast.type === 'success' ? '#e6ffed' : '#ffecec', border: `1px solid ${toast.type === 'success' ? '#b7eb8f' : '#ffa39e'}`, color: toast.type === 'success' ? '#389e0d' : '#cf1322', fontWeight: 800, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: isMobile ? 13 : 14 }}>
          {toast.msg}
        </div>
      )}

      <div style={pageWrap}>
        {notifications.length > 0 && (
          <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 14, background: '#fff1f1', border: '1px solid #ffcccc' }}>
            <div style={{ fontWeight: 900, color: '#c0392b', marginBottom: 6 }}>
              🔔 库存提醒（{notifications.length}）
            </div>

            {notifications.map((n) => (
              <div key={n.id} style={{ fontSize: 14, color: '#c0392b', cursor: 'pointer', padding: '6px 0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }} onClick={() => markNotificationRead(n.id)}>
                <span>🔴 {n.message}</span>
                <span style={{ fontSize: 12, fontWeight: 800 }}>点击已处理</span>
              </div>
            ))}
          </div>
        )}

        <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, marginBottom: isMobile ? 12 : 20 }}>后台管理</h1>

        <div style={{ marginBottom: isMobile ? 14 : 20, padding: isMobile ? 12 : 16, borderRadius: isMobile ? 14 : 16, border: '1px solid #ffcccc', background: '#fff5f5', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 1fr) auto auto', gap: isMobile ? 8 : 10, alignItems: 'center' }}>
          <select value={resetAgentId} onChange={(e) => setResetAgentId(e.target.value)} disabled={resetLoading} style={{ padding: isMobile ? '9px 10px' : '10px 12px', borderRadius: 10, border: '1px solid #d7bfa8', minWidth: 0, width: '100%', fontSize: isMobile ? 13 : 14 }}>
            <option value="">选择 Agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.code || a.slug} — #{a.id}
              </option>
            ))}
          </select>

          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: isMobile ? '9px 10px' : '10px 12px', borderRadius: 10, border: '1px solid #d7bfa8', width: '100%', fontSize: isMobile ? 13 : 14 }} />

          <button type="button" onClick={handleResetAgent} disabled={resetLoading} style={{ padding: isMobile ? '10px 12px' : '10px 16px', background: resetLoading ? '#ccc' : '#ff4d4f', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: resetLoading ? 'not-allowed' : 'pointer', width: '100%', fontSize: isMobile ? 13 : 14 }}>
            {resetLoading ? '重置中...' : '🧨 Reset Agent'}
          </button>
        </div>

        {saveMsg ? (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: '#eefaf0', border: '1px solid #b9dfbe', fontWeight: 800 }}>
            {saveMsg}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: isMobile ? 14 : 20 }}>
          <div style={statCard}>
            <div>今日销售</div>
            <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900 }}>RM {todaySales.toFixed(2)}</div>
          </div>

          <div style={statCard}>
            <div>本月销售</div>
            <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900 }}>RM {monthSales.toFixed(2)}</div>
          </div>
<div style={statCard}>
  <div>今日利润</div>
  <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color: '#2e7d32' }}>
    RM {todayProfit.toFixed(2)}
  </div>
</div>

<div style={statCard}>
  <div>本月利润</div>
  <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color: '#2e7d32' }}>
    RM {monthProfit.toFixed(2)}
  </div>
</div>
          <div style={statCard}>
            <div>低库存产品</div>
            <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900 }}>{lowStock.length}</div>
          </div>

          <div style={{ ...statCard, background: '#ffe9e9' }}>
            <div>缺货产品</div>
            <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900 }}>{outStock.length}</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, marginBottom: isMobile ? 8 : 10 }}>📊 AI 商业分析</h2>
          <div style={sectionCard}>
            {insights.length === 0 && <div>暂无分析</div>}
            {insights.map((text, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #eee', fontWeight: 600 }}>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, marginBottom: isMobile ? 8 : 10 }}>🏆 Agent 排行榜</h2>
          <div style={sectionCard}>
            {agentRanking.length === 0 && <div>暂无数据</div>}

            {agentRanking.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: isMobile ? 8 : 12 }}>
                {agentRanking.map((a, i) => (
                  <div key={a.name} style={{ ...getRankCardStyle(i), borderRadius: isMobile ? 14 : 16, padding: isMobile ? '12px' : '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900 }}>{getRankBadge(i)}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, padding: '6px 10px', borderRadius: 999, border: '1px solid #d7bfa8', background: '#fffaf5' }}>
                        第 {i + 1} 名
                      </div>
                    </div>

                    <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, marginBottom: isMobile ? 8 : 10, wordBreak: 'break-word' }}>{a.name}</div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>销售额</span>
                        <strong>RM {a.total.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>订单数</span>
                        <strong>{a.count}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>平均单价</span>
                        <strong>RM {a.avg.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, marginBottom: isMobile ? 8 : 10 }}>🔥 本月热卖产品</h2>
          <div style={sectionCard}>
            {topProducts.length === 0 && <div>暂无数据</div>}

            {topProducts.map((p, i) => (
              <div key={`${p.category}-${p.brand}-${p.name}`} style={{ display: 'flex', flexDirection: 'column', padding: isMobile ? '10px 4px' : '12px 10px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 900 }}>
                  {i + 1}. {p.name}
                </div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  {p.category} ｜ {p.brand}
                </div>
                <div style={{ fontWeight: 800 }}>销量：{p.qty}</div>
                <div>销售额：RM {Number(p.sales || 0).toFixed(2)}</div>
                <div style={{ fontWeight: 900, color: Number(p.profit || 0) >= 0 ? '#2e7d32' : '#c0392b' }}>
                  利润：RM {Number(p.profit || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, marginBottom: isMobile ? 8 : 10 }}>❌ OUT OF STOCK 分类总览</h2>
          <div style={{ ...sectionCard, background: '#fffdfd' }}>{renderStockGroup(groupedOutStock, 'out')}</div>
        </div>

        <div>
          <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, marginBottom: isMobile ? 8 : 10 }}>⚠️ 低库存产品</h2>
          <div style={{ ...sectionCard, background: '#fffdf8' }}>{renderStockGroup(groupedLowStock, 'low')}</div>
        </div>
      </div>
    </>
  )
}
