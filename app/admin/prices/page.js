'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PricesAdminPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [seriesName, setSeriesName] = useState('')
  const [level1Price, setLevel1Price] = useState('')
  const [level2Price, setLevel2Price] = useState('')
  const [level3Price, setLevel3Price] = useState('')

  useEffect(() => {
    fetchPrices()
  }, [])

  function groupPrices(rawRows) {
    const map = {}

    for (const item of rawRows || []) {
      const key = (item.series || '').trim()
      if (!key) continue

      if (!map[key]) {
        map[key] = {
          id: key,
          series: key,
          level_1_price: '',
          level_2_price: '',
          level_3_price: '',
        }
      }

      if (Number(item.agent_level) === 1) {
        map[key].level_1_price = item.price ?? ''
      }
      if (Number(item.agent_level) === 2) {
        map[key].level_2_price = item.price ?? ''
      }
      if (Number(item.agent_level) === 3) {
        map[key].level_3_price = item.price ?? ''
      }
    }

    return Object.values(map).sort((a, b) =>
      a.series.localeCompare(b.series, undefined, { sensitivity: 'base' })
    )
  }

  async function fetchPrices() {
    setLoading(true)

    const { data, error } = await supabase
      .from('series_prices')
      .select('id, series, agent_level, price')
      .order('series', { ascending: true })
      .order('agent_level', { ascending: true })

    setLoading(false)

    if (error) {
      alert('读取价格失败：' + error.message)
      return
    }

    setRows(groupPrices(data || []))
  }

  async function addSeriesPrice() {
    const cleanSeries = seriesName.trim()

    if (!cleanSeries) {
      alert('请输入 SERIES 名称')
      return
    }

    if (level1Price === '' || level2Price === '' || level3Price === '') {
      alert('请填写完整三级价格')
      return
    }

    setLoading(true)

    const { data: existingRows, error: checkError } = await supabase
      .from('series_prices')
      .select('id, series, agent_level')
      .eq('series', cleanSeries)

    if (checkError) {
      setLoading(false)
      alert('检查系列失败：' + checkError.message)
      return
    }

    if ((existingRows || []).length > 0) {
      setLoading(false)
      alert('这个 SERIES 已存在，请直接在下方修改价格')
      return
    }

    const payload = [
      {
        series: cleanSeries,
        agent_level: 1,
        price: Number(level1Price),
      },
      {
        series: cleanSeries,
        agent_level: 2,
        price: Number(level2Price),
      },
      {
        series: cleanSeries,
        agent_level: 3,
        price: Number(level3Price),
      },
    ]

    const { error } = await supabase.from('series_prices').insert(payload)

    setLoading(false)

    if (error) {
      alert('新增失败：' + error.message)
      return
    }

    alert('新增成功')
    setSeriesName('')
    setLevel1Price('')
    setLevel2Price('')
    setLevel3Price('')
    fetchPrices()
  }

  async function updateSeriesName(oldSeries, newSeries) {
    const cleanNewSeries = newSeries.trim()
    const cleanOldSeries = (oldSeries || '').trim()

    if (!cleanNewSeries) {
      alert('SERIES 名称不能为空')
      fetchPrices()
      return
    }

    if (cleanNewSeries === cleanOldSeries) return

    const { data: targetExists, error: checkError } = await supabase
      .from('series_prices')
      .select('id')
      .eq('series', cleanNewSeries)
      .limit(1)

    if (checkError) {
      alert('检查系列名称失败：' + checkError.message)
      fetchPrices()
      return
    }

    if ((targetExists || []).length > 0) {
      alert('新 SERIES 名称已存在，不能重复')
      fetchPrices()
      return
    }

    const { error } = await supabase
      .from('series_prices')
      .update({ series: cleanNewSeries })
      .eq('series', cleanOldSeries)

    if (error) {
      alert('更新系列名称失败：' + error.message)
      fetchPrices()
      return
    }

    fetchPrices()
  }

  async function updatePrice(series, agentLevel, value) {
    if (value === '') {
      alert('价格不能为空')
      fetchPrices()
      return
    }

    const finalValue = Number(value)

    if (Number.isNaN(finalValue)) {
      alert('请输入有效价格')
      fetchPrices()
      return
    }

    const { data: existingRow, error: checkError } = await supabase
      .from('series_prices')
      .select('id')
      .eq('series', series)
      .eq('agent_level', agentLevel)
      .maybeSingle()

    if (checkError) {
      alert('检查价格失败：' + checkError.message)
      fetchPrices()
      return
    }

    let error = null

    if (existingRow?.id) {
      const result = await supabase
        .from('series_prices')
        .update({ price: finalValue })
        .eq('id', existingRow.id)

      error = result.error
    } else {
      const result = await supabase.from('series_prices').insert([
        {
          series,
          agent_level: agentLevel,
          price: finalValue,
        },
      ])

      error = result.error
    }

    if (error) {
      alert('更新失败：' + error.message)
      fetchPrices()
      return
    }

    fetchPrices()
  }

  async function deleteSeriesPrice(series) {
    const ok = window.confirm(`确定删除系列价格「${series}」吗？`)
    if (!ok) return

    const { error } = await supabase
      .from('series_prices')
      .delete()
      .eq('series', series)

    if (error) {
      alert('删除失败：' + error.message)
      return
    }

    alert('已删除')
    fetchPrices()
  }

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8f1ea 0%, #fdfaf7 100%)',
      padding: 24,
      fontFamily: 'Arial, sans-serif',
    },
    shell: {
      maxWidth: 1180,
      margin: '0 auto',
    },
    hero: {
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #c8a27a 0%, #d8b89a 45%, #efe3d6 100%)',
      borderRadius: 28,
      padding: '28px 28px 22px',
      color: '#4b3425',
      boxShadow: '0 12px 28px rgba(120,90,60,0.14)',
      marginBottom: 20,
      border: '1px solid #e7d7c7',
    },
    heroDog: {
      position: 'absolute',
      right: 22,
      top: 12,
      fontSize: 54,
      opacity: 0.14,
      pointerEvents: 'none',
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: 800,
      marginBottom: 8,
      color: '#4b3425',
    },
    heroSub: {
      fontSize: 14,
      lineHeight: 1.8,
      color: '#6b4f3f',
    },
    card: {
      background: '#fffdfb',
      border: '1px solid #eadccf',
      borderRadius: 24,
      padding: 20,
      marginBottom: 20,
      boxShadow: '0 10px 24px rgba(120,90,60,0.05)',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 800,
      color: '#6b4f3f',
      marginBottom: 14,
    },
    row4: {
      display: 'grid',
      gridTemplateColumns: '1.8fr 1fr 1fr 1fr',
      gap: 12,
      marginBottom: 12,
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      borderRadius: 16,
      border: '1px solid #d9c2ad',
      outline: 'none',
      fontSize: 14,
      background: '#fffaf5',
      boxSizing: 'border-box',
    },
    buttonDark: {
      padding: '14px 20px',
      borderRadius: 18,
      border: 'none',
      background: '#8b6b4f',
      color: '#fff',
      fontWeight: 800,
      fontSize: 15,
      cursor: 'pointer',
      boxShadow: '0 10px 22px rgba(139,107,79,0.18)',
    },
    buttonLight: {
      padding: '8px 12px',
      borderRadius: 12,
      border: '1px solid #dcc3aa',
      background: '#fffaf5',
      color: '#6b4f3f',
      fontWeight: 700,
      cursor: 'pointer',
    },
    tableWrap: {
      overflowX: 'auto',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      padding: 12,
      borderBottom: '1px solid #eadccf',
      background: '#faf4ee',
      fontSize: 14,
      whiteSpace: 'nowrap',
      color: '#6b4f3f',
    },
    td: {
      padding: 12,
      borderBottom: '1px solid #f0e6dd',
      verticalAlign: 'middle',
      fontSize: 14,
      color: '#4b3425',
    },
    smallInput: {
      width: 140,
      padding: '8px 10px',
      borderRadius: 12,
      border: '1px solid #d9c2ad',
      outline: 'none',
      boxSizing: 'border-box',
      background: '#fffaf5',
    },
    seriesInput: {
      width: 220,
      padding: '8px 10px',
      borderRadius: 12,
      border: '1px solid #d9c2ad',
      outline: 'none',
      boxSizing: 'border-box',
      background: '#fffaf5',
    },
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.heroDog}>🐶</div>
          <div style={styles.heroTitle}>系列价格管理</div>
          <div style={styles.heroSub}>
            在这里统一管理一级、二级、三级代理价格，改一次，全系统同步更新。
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.sectionTitle}>新增系列价格</div>

          <div style={styles.row4}>
            <input
              placeholder="SERIES 名称"
              value={seriesName}
              onChange={(e) => setSeriesName(e.target.value)}
              style={styles.input}
            />

            <input
              type="number"
              placeholder="一级价"
              value={level1Price}
              onChange={(e) => setLevel1Price(e.target.value)}
              style={styles.input}
            />

            <input
              type="number"
              placeholder="二级价"
              value={level2Price}
              onChange={(e) => setLevel2Price(e.target.value)}
              style={styles.input}
            />

            <input
              type="number"
              placeholder="三级价"
              value={level3Price}
              onChange={(e) => setLevel3Price(e.target.value)}
              style={styles.input}
            />
          </div>

          <button
            onClick={addSeriesPrice}
            disabled={loading}
            style={styles.buttonDark}
          >
            {loading ? '处理中...' : '新增系列价格'}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.sectionTitle}>现有系列价格</div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>SERIES</th>
                  <th style={styles.th}>一级价</th>
                  <th style={styles.th}>二级价</th>
                  <th style={styles.th}>三级价</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>
                      <input
                        defaultValue={row.series}
                        onBlur={(e) => updateSeriesName(row.series, e.target.value)}
                        style={styles.seriesInput}
                      />
                    </td>

                    <td style={styles.td}>
                      <input
                        type="number"
                        defaultValue={row.level_1_price}
                        onBlur={(e) => updatePrice(row.series, 1, e.target.value)}
                        style={styles.smallInput}
                      />
                    </td>

                    <td style={styles.td}>
                      <input
                        type="number"
                        defaultValue={row.level_2_price}
                        onBlur={(e) => updatePrice(row.series, 2, e.target.value)}
                        style={styles.smallInput}
                      />
                    </td>

                    <td style={styles.td}>
                      <input
                        type="number"
                        defaultValue={row.level_3_price}
                        onBlur={(e) => updatePrice(row.series, 3, e.target.value)}
                        style={styles.smallInput}
                      />
                    </td>

                    <td style={styles.td}>
                      <button
                        onClick={() => deleteSeriesPrice(row.series)}
                        style={styles.buttonLight}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={styles.td}>
                      还没有系列价格资料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}