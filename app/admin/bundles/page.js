'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const emptyForm = {
  name: '',
  brand: '',
  buy_qty: '10',
  free_qty: '1',
  min_select_qty: '11',
  bundle_price_1: '0',
  bundle_price_2: '0',
  bundle_price_3: '0',
  is_active: true,
}

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchBundles()
  }, [])

  async function fetchBundles() {
    setMessage('')

    const { data, error } = await supabase
      .from('bundle_rules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setMessage(error.message)
    else setBundles(data || [])
  }

  function handleChange(key, value) {
    const next = { ...form, [key]: value }

    const buy = Number(key === 'buy_qty' ? value : next.buy_qty || 0)
    const free = Number(key === 'free_qty' ? value : next.free_qty || 0)
    next.min_select_qty = String(buy + free)

    setForm(next)
  }

  function handleCheckboxChange(key, checked) {
    setForm((prev) => ({
      ...prev,
      [key]: checked,
    }))
  }

  function resetForm() {
    setEditingId('')
    setForm(emptyForm)
  }

  function editRow(row) {
    setEditingId(row.id)
    setForm({
      name: row.name || '',
      brand: row.brand || '',
      buy_qty: String(row.buy_qty ?? 10),
      free_qty: String(row.free_qty ?? 1),
      min_select_qty: String(
        row.min_select_qty ?? (Number(row.buy_qty || 0) + Number(row.free_qty || 0))
      ),
      bundle_price_1: String(row.bundle_price_1 ?? 0),
      bundle_price_2: String(row.bundle_price_2 ?? 0),
      bundle_price_3: String(row.bundle_price_3 ?? 0),
      is_active: row.is_active ?? true,
    })
  }

  async function submitForm(e) {
    e.preventDefault()
    setMessage('')

    const cleanName = String(form.name || '').trim()
    const cleanBrand = String(form.brand || '').trim()
    const buyQty = Number(form.buy_qty || 0)
    const freeQty = Number(form.free_qty || 0)
    const minSelectQty = Number(form.min_select_qty || 0)
    const bundlePrice1 = Number(form.bundle_price_1 || 0)
    const bundlePrice2 = Number(form.bundle_price_2 || 0)
    const bundlePrice3 = Number(form.bundle_price_3 || 0)

    if (!cleanName) {
      setMessage('请填写 Bundle Name')
      return
    }

    if (!cleanBrand) {
      setMessage('请填写 Brand')
      return
    }

    if (buyQty <= 0) {
      setMessage('Buy Qty 必须大于 0')
      return
    }

    if (freeQty < 0) {
      setMessage('Free Qty 不能小于 0')
      return
    }

    if (minSelectQty <= 0) {
      setMessage('Need Select 必须大于 0')
      return
    }

    const payload = {
      name: cleanName,
      brand: cleanBrand,
      buy_qty: buyQty,
      free_qty: freeQty,
      min_select_qty: minSelectQty,
      bundle_price_1: bundlePrice1,
      bundle_price_2: bundlePrice2,
      bundle_price_3: bundlePrice3,
      is_active: !!form.is_active,
      updated_at: new Date().toISOString(),
    }

    const res = editingId
      ? await supabase.from('bundle_rules').update(payload).eq('id', editingId)
      : await supabase.from('bundle_rules').insert({
          ...payload,
          created_at: new Date().toISOString(),
        })

    if (res.error) {
      setMessage(res.error.message)
    } else {
      setMessage(editingId ? 'Bundle 已更新' : 'Bundle 已新增')
      resetForm()
      fetchBundles()
    }
  }

  async function deleteRow(id) {
    const ok = window.confirm('确定删除这个 Bundle？')
    if (!ok) return

    const { error } = await supabase.from('bundle_rules').delete().eq('id', id)
    if (error) setMessage(error.message)
    else {
      setMessage('Bundle 已删除')
      fetchBundles()
    }
  }

  async function toggleActive(row) {
    const { error } = await supabase
      .from('bundle_rules')
      .update({
        is_active: !(row.is_active ?? true),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(`Bundle 已${row.is_active ? '停用' : '启用'}`)
      fetchBundles()
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f7efe7', padding: 24, color: '#6f4e37' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 20 }}>Bundle 规则管理</h1>

        <form onSubmit={submitForm} style={boxStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
            <input
              placeholder="Bundle Name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Brand（必须和 products.brand 一样）"
              value={form.brand}
              onChange={(e) => handleChange('brand', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Buy Qty"
              type="number"
              min="1"
              value={form.buy_qty}
              onChange={(e) => handleChange('buy_qty', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Free Qty"
              type="number"
              min="0"
              value={form.free_qty}
              onChange={(e) => handleChange('free_qty', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Need Select"
              value={form.min_select_qty}
              readOnly
              style={inputStyle}
            />

            <input
              placeholder="Bundle Price 1"
              type="number"
              min="0"
              step="0.01"
              value={form.bundle_price_1}
              onChange={(e) => handleChange('bundle_price_1', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Bundle Price 2"
              type="number"
              min="0"
              step="0.01"
              value={form.bundle_price_2}
              onChange={(e) => handleChange('bundle_price_2', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Bundle Price 3"
              type="number"
              min="0"
              step="0.01"
              value={form.bundle_price_3}
              onChange={(e) => handleChange('bundle_price_3', e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="is_active"
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => handleCheckboxChange('is_active', e.target.checked)}
            />
            <label htmlFor="is_active" style={{ fontWeight: 700 }}>
              启用 Bundle
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" style={primaryButton}>
              {editingId ? '更新 Bundle' : '新增 Bundle'}
            </button>
            <button type="button" style={secondaryButton} onClick={resetForm}>
              清空
            </button>
          </div>
        </form>

        {message && <div style={messageStyle}>{message}</div>}

        <div style={boxStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Name',
                  'Brand',
                  'Buy',
                  'Free',
                  'Need Select',
                  'Price 1',
                  'Price 2',
                  'Price 3',
                  '状态',
                  '操作',
                ].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id}>
                  <td style={tdStyle}>{b.name}</td>
                  <td style={tdStyle}>{b.brand}</td>
                  <td style={tdStyle}>{b.buy_qty}</td>
                  <td style={tdStyle}>{b.free_qty}</td>
                  <td style={tdStyle}>{b.min_select_qty ?? '-'}</td>
                  <td style={tdStyle}>RM {Number(b.bundle_price_1 || 0).toFixed(2)}</td>
                  <td style={tdStyle}>RM {Number(b.bundle_price_2 || 0).toFixed(2)}</td>
                  <td style={tdStyle}>RM {Number(b.bundle_price_3 || 0).toFixed(2)}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        border: b.is_active ? '1px solid #b9ddb8' : '1px solid #e2c1c1',
                        background: b.is_active ? '#edf9ed' : '#fff3f3',
                        color: b.is_active ? '#2f7a35' : '#a14f4f',
                      }}
                    >
                      {b.is_active ? '启用中' : '已停用'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" style={smallPrimaryButton} onClick={() => editRow(b)}>
                        编辑
                      </button>
                      <button type="button" style={smallSecondaryButton} onClick={() => toggleActive(b)}>
                        {b.is_active ? '停用' : '启用'}
                      </button>
                      <button type="button" style={smallDangerButton} onClick={() => deleteRow(b.id)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {bundles.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      color: '#9b7b63',
                      padding: '20px 12px',
                    }}
                  >
                    暂时没有 Bundle 规则
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
  overflowX: 'auto',
}

const inputStyle = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid #d7bfa8',
  background: '#fff',
  padding: '0 12px',
  outline: 'none',
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

const secondaryButton = {
  height: 46,
  padding: '0 18px',
  borderRadius: 14,
  border: '1px solid #d7bfa8',
  background: '#fff8f1',
  color: '#6f4e37',
  fontWeight: 800,
  cursor: 'pointer',
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

const smallSecondaryButton = {
  height: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #d7bfa8',
  background: '#fff8f1',
  color: '#6f4e37',
  fontWeight: 700,
  cursor: 'pointer',
}

const smallDangerButton = {
  height: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #d9a0a0',
  background: '#fff4f4',
  color: '#a14f4f',
  fontWeight: 700,
  cursor: 'pointer',
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
  verticalAlign: 'middle',
}

const messageStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px solid #d8b99d',
}