'use client'

import Link from 'next/link'
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
      if (d.getMonth() === month && d.getFullYear() === year) {
        monthTotal += sales
      }

      const name = o.agent_name || 'UNKNOWN'
      if (!agentMap[name]) agentMap[name] = 0
      agentMap[name] += sales
    })

    const ranking = Object.entries(agentMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // 🔥 低库存
    const low = products.filter(p => Number(p.stock || 0) <= 50 && Number(p.stock || 0) > 0)

    // 🔥 OUT OF STOCK
    const out = products.filter(p => Number(p.stock || 0) === 0)

    // 🔥 分组（分类 + 品牌）
    const grouped = {}

    out.forEach(p => {
      const category = p.category || '未分类'
      const brand = p.series || p.brand || '其他'

      if (!grouped[category]) grouped[category] = {}
      if (!grouped[category][brand]) grouped[category][brand] = []

      grouped[category][brand].push(p.name)
    })

    setTodaySales(todayTotal)
    setMonthSales(monthTotal)
    setAgentRanking(ranking)
    setLowStock(low)
    setOutStock(out)
    setGroupedOutStock(grouped)
  }

  const cardStyle = {
    display: 'block',
    padding: '20px',
    borderRadius: '18px',
    border: '1px solid #d7bfa8',
    background: '#fffaf5',
    color: '#6f4e37',
    textDecoration: 'none',
    fontWeight: 800,
  }

  const statCard = {
    padding: '20px',
    borderRadius: '18px',
    border: '1px solid #d7bfa8',
    background: '#fff',
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

        {/* 🔥 统计 */}
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

          {/* 🔥 NEW */}
          <div style={{ ...statCard, background: '#ffe5e5' }}>
            <div>❌ 缺货产品</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              {outStock.length}
            </div>
          </div>
        </div>

        {/* 🔥 功能入口 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: 20,
          }}
        >
          <Link href="/admin/products" style={cardStyle}>
            产品管理
          </Link>

          <Link href="/admin/bundles" style={cardStyle}>
            Bundle 规则管理
          </Link>

          <Link href="/admin/orders" style={cardStyle}>
            订单列表
          </Link>
        </div>

        {/* 🔥 OUT OF STOCK 分组 */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
            ❌ OUT OF STOCK 分类总览
          </h2>

          <div style={statCard}>
            {Object.keys(groupedOutStock).length === 0 && <div>暂无缺货</div>}

            {Object.entries(groupedOutStock).map(([category, brands]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 900 }}>{category}</div>

                {Object.entries(brands).map(([brand, items]) => (
                  <div key={brand} style={{ marginLeft: 10 }}>
                    <div style={{ fontWeight: 700 }}>{brand}</div>

                    {items.map((name, i) => (
                      <div key={i} style={{ marginLeft: 10 }}>
                        - {name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 🔥 低库存 */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
            ⚠️ 低库存产品
          </h2>

          <div style={statCard}>
            {lowStock.slice(0, 5).map(p => (
              <div key={p.id}>
                {p.name} - stock: {p.stock}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}