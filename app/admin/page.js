'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])

  const [todaySales, setTodaySales] = useState(0)
  const [monthSales, setMonthSales] = useState(0)
  const [agentRanking, setAgentRanking] = useState([])

  const [lowStock, setLowStock] = useState([])
  const [outStock, setOutStock] = useState([])

  const [groupedOutStock, setGroupedOutStock] = useState({})
  const [groupedLowStock, setGroupedLowStock] = useState({})

  const [stockInputs, setStockInputs] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [saveMsg, setSaveMsg] = useState('')

  const [collapsedOut, setCollapsedOut] = useState({})
  const [collapsedLow, setCollapsedLow] = useState({})

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: orderData } = await supabase.from('orders').select('*')
    const { data: productData } = await supabase.from('products').select('*')

    const o = orderData || []
    const p = productData || []

    setOrders(o)
    setProducts(p)

    calculateStats(o, p)
  }

  function getNetSales(order) {
    const total = Number(order.total_amount || 0)
    const shipping = Number(order.shipping_fee || 0)
    const lalamove = Number(order.lalamove_fee || 0)
    return total - shipping - lalamove
  }

  function groupProducts(items) {
    const grouped = {}

    items.forEach(p => {
      const category = String(p.category || '未分类').trim()
      const brand = String(p.series || p.brand || '其他').trim()

      if (!grouped[category]) grouped[category] = {}
      if (!grouped[category][brand]) grouped[category][brand] = []

      grouped[category][brand].push(p)
    })

    return grouped
  }

  function buildCollapsedState(grouped, prevState = {}) {
    const next = { ...prevState }

    Object.keys(grouped).forEach(category => {
      if (typeof next[category] === 'undefined') {
        next[category] = false
      }
    })

    return next
  }

  function calculateStats(orders, products) {
    const today = new Date().toISOString().slice(0, 10)

    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()

    let todayTotal = 0
    let monthTotal = 0

    const agentMap = {}

    orders.forEach(o => {
      const sales = getNetSales(o)

      if (o.created_at?.slice(0, 10) === today) {
        todayTotal += sales
      }

      const d = new Date(o.created_at)
      if (!Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year) {
        monthTotal += sales
      }

      const name = String(o.agent_name || 'UNKNOWN').trim() || 'UNKNOWN'

      if (!agentMap[name]) {
        agentMap[name] = {
          name,
          total: 0,
          count: 0,
        }
      }

      agentMap[name].total += sales
      agentMap[name].count += 1
    })

    const ranking = Object.values(agentMap)
      .map(agent => ({
        ...agent,
        avg: agent.count > 0 ? agent.total / agent.count : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const low = products.filter(p => {
      const stock = Number(p.stock || 0)
      return stock > 0 && stock <= 50
    })

    const out = products.filter(p => Number(p.stock || 0) === 0)

    const groupedOut = groupProducts(out)
    const groupedLow = groupProducts(low)

    setTodaySales(todayTotal)
    setMonthSales(monthTotal)
    setAgentRanking(ranking)
    setLowStock(low)
    setOutStock(out)
    setGroupedOutStock(groupedOut)
    setGroupedLowStock(groupedLow)

    setCollapsedOut(prev => buildCollapsedState(groupedOut, prev))
    setCollapsedLow(prev => buildCollapsedState(groupedLow, prev))
  }

  function handleStockInput(productId, value) {
    setStockInputs(prev => ({
      ...prev,
      [productId]: value,
    }))
  }

  async function saveStock(productId) {
    const raw = stockInputs[productId]
    const newStock = Number(raw)

    if (raw === undefined || raw === '' || Number.isNaN(newStock) || newStock < 0) {
      alert('请输入正确库存')
      return
    }

    setSavingId(productId)
    setSaveMsg('')

    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId)

    if (error) {
      alert(`更新失败：${error.message}`)
      setSavingId(null)
      return
    }

    setSaveMsg('库存已更新')
    setStockInputs(prev => ({
      ...prev,
      [productId]: '',
    }))

    await init()
    setSavingId(null)

    setTimeout(() => {
      setSaveMsg('')
    }, 1800)
  }

  function quickFill(productId, qty) {
    setStockInputs(prev => ({
      ...prev,
      [productId]: String(qty),
    }))
  }

  function toggleCollapse(type, category) {
    if (type === 'out') {
      setCollapsedOut(prev => ({
        ...prev,
        [category]: !prev[category],
      }))
      return
    }

    setCollapsedLow(prev => ({
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
    if (index === 0) {
      return {
        background: '#fff7e6',
        border: '1px solid #ecd8a6',
      }
    }

    if (index === 1) {
      return {
        background: '#f8f8f8',
        border: '1px solid #dddddd',
      }
    }

    if (index === 2) {
      return {
        background: '#fff4ee',
        border: '1px solid #e7c7b5',
      }
    }

    return {
      background: '#fff',
      border: '1px solid #ead8c8',
    }
  }

  const statCard = {
    padding: '20px',
    borderRadius: '18px',
    border: '1px solid #d7bfa8',
    background: '#fff',
  }

  const sectionCard = {
    padding: '20px',
    borderRadius: '18px',
    border: '1px solid #d7bfa8',
    background: '#fff',
  }

  const miniBtn = {
    padding: '6px 10px',
    borderRadius: '10px',
    border: '1px solid #d7bfa8',
    background: '#fffaf5',
    color: '#6f4e37',
    cursor: 'pointer',
    fontWeight: 700,
  }

  const saveBtn = {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #c89f7a',
    background: '#6f4e37',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
  }

  const categoryHeaderBtn = {
    border: '1px solid #d7bfa8',
    background: '#fff',
    color: '#6f4e37',
    padding: '8px 12px',
    borderRadius: 10,
    fontWeight: 800,
    cursor: 'pointer',
  }

  const viewLinkStyle = {
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #d7bfa8',
    background: '#fffaf5',
    color: '#6f4e37',
    textDecoration: 'none',
    fontWeight: 800,
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
        <div
          key={category}
          style={{
            marginBottom: 20,
            border: '1px solid #ead8c8',
            borderRadius: 16,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              background: isOut ? '#fff1f1' : '#fff8ea',
              borderBottom: isCollapsed ? 'none' : '1px solid #f0e0d3',
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {category}
              </div>
              <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
                共 {totalCount} 个产品
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={`/admin/products?stock=${stockParam}&category=${encodeURIComponent(category)}`}
                style={viewLinkStyle}
              >
                查看产品
              </a>

              <button
                type="button"
                style={categoryHeaderBtn}
                onClick={() => toggleCollapse(type, category)}
              >
                {isCollapsed ? '展开' : '收起'}
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <div style={{ padding: 14 }}>
              {Object.entries(brands).map(([brand, items]) => (
                <div
                  key={brand}
                  style={{
                    marginBottom: 12,
                    padding: '12px',
                    borderRadius: '14px',
                    background: isOut ? '#fff8f8' : '#fffdf6',
                    border: '1px solid #ead8c8',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      marginBottom: 10,
                      color: '#6f4e37',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{brand}</span>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>
                      {items.length} 个产品
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {items.map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(180px, 1fr) 110px minmax(140px, 220px) auto',
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          background: '#fff',
                          border: '1px solid #f0e0d3',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {p.name}
                        </div>

                        <div
                          style={{
                            fontWeight: 800,
                            color: isOut ? '#c0392b' : '#b9770e',
                          }}
                        >
                          stock: {Number(p.stock || 0)}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="输入库存"
                            value={stockInputs[p.id] ?? ''}
                            onChange={e => handleStockInput(p.id, e.target.value)}
                            style={{
                              width: 100,
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: '1px solid #d7bfa8',
                              outline: 'none',
                            }}
                          />

                          <button type="button" style={miniBtn} onClick={() => quickFill(p.id, 10)}>
                            10
                          </button>
                          <button type="button" style={miniBtn} onClick={() => quickFill(p.id, 20)}>
                            20
                          </button>
                          <button type="button" style={miniBtn} onClick={() => quickFill(p.id, 50)}>
                            50
                          </button>
                        </div>

                        <div>
                          <button
                            type="button"
                            style={{
                              ...saveBtn,
                              opacity: savingId === p.id ? 0.7 : 1,
                            }}
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
    <main
      style={{
        minHeight: '100vh',
        background: '#f7efe7',
        padding: '24px',
        color: '#6f4e37',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 20 }}>
          后台管理
        </h1>

        {saveMsg ? (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 12,
              background: '#eefaf0',
              border: '1px solid #b9dfbe',
              fontWeight: 800,
            }}
          >
            {saveMsg}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div style={statCard}>
            <div>今日销售</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              RM {todaySales.toFixed(2)}
            </div>
          </div>

          <div style={statCard}>
            <div>本月销售</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              RM {monthSales.toFixed(2)}
            </div>
          </div>

          <div style={statCard}>
            <div>低库存产品</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              {lowStock.length}
            </div>
          </div>

          <div style={{ ...statCard, background: '#ffe9e9' }}>
            <div>缺货产品</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              {outStock.length}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
            🏆 Agent 排行榜
          </h2>

          <div style={sectionCard}>
            {agentRanking.length === 0 && <div>暂无数据</div>}

            {agentRanking.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {agentRanking.map((a, i) => (
                  <div
                    key={a.name}
                    style={{
                      ...getRankCardStyle(i),
                      borderRadius: 16,
                      padding: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 22, fontWeight: 900 }}>
                        {getRankBadge(i)}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: '1px solid #d7bfa8',
                          background: '#fffaf5',
                        }}
                      >
                        第 {i + 1} 名
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        marginBottom: 10,
                        wordBreak: 'break-word',
                      }}
                    >
                      {a.name}
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <span>销售额</span>
                        <strong>RM {a.total.toFixed(2)}</strong>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <span>订单数</span>
                        <strong>{a.count}</strong>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
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
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
            ❌ OUT OF STOCK 分类总览
          </h2>

          <div style={{ ...sectionCard, background: '#fffdfd' }}>
            {renderStockGroup(groupedOutStock, 'out')}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
            ⚠️ 低库存产品
          </h2>

          <div style={{ ...sectionCard, background: '#fffdf8' }}>
            {renderStockGroup(groupedLowStock, 'low')}
          </div>
        </div>
      </div>
    </main>
  )
}