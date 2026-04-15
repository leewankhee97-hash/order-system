'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const emptyForm = {
  name: '',
  brand: '',
  series: '',
  buy_qty: '10',
  free_qty: '1',
  required_qty: '11',
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
    next.required_qty = String(buy + free)
    setForm(next)
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
      series: row.series || '',
      buy_qty: String(row.buy_qty ?? 10),
      free_qty: String(row.free_qty ?? 1),
      required_qty: String(row.required_qty ?? 11),
    })
  }

  async function submitForm(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      name: form.name,
      brand: form.brand,
      series: form.series,
      buy_qty: Number(form.buy_qty || 10),
      free_qty: Number(form.free_qty || 1),
      required_qty: Number(form.required_qty || 11),
    }

    const res = editingId
      ? await supabase.from('bundle_rules').update(payload).eq('id', editingId)
      : await supabase.from('bundle_rules').insert(payload)

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

  return (
    <main style={{ minHeight: '100vh', background: '#f7efe7', padding: 24, color: '#6f4e37' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 20 }}>Bundle 规则管理</h1>

        <form onSubmit={submitForm} style={boxStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
            <input placeholder="Name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} style={inputStyle} />
            <input placeholder="Brand" value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} style={inputStyle} />
            <input placeholder="Series" value={form.series} onChange={(e) => handleChange('series', e.target.value)} style={inputStyle} />
            <input placeholder="Buy Qty" value={form.buy_qty} onChange={(e) => handleChange('buy_qty', e.target.value)} style={inputStyle} />
            <input placeholder="Free Qty" value={form.free_qty} onChange={(e) => handleChange('free_qty', e.target.value)} style={inputStyle} />
            <input placeholder="Required Qty" value={form.required_qty} readOnly style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" style={primaryButton}>{editingId ? '更新 Bundle' : '新增 Bundle'}</button>
            <button type="button" style={secondaryButton} onClick={resetForm}>清空</button>
          </div>
        </form>

        {message && <div style={messageStyle}>{message}</div>}

        <div style={boxStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Brand', 'Series', 'Buy', 'Free', 'Required', '操作'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id}>
                  <td style={tdStyle}>{b.name}</td>
                  <td style={tdStyle}>{b.brand}</td>
                  <td style={tdStyle}>{b.series}</td>
                  <td style={tdStyle}>{b.buy_qty}</td>
                  <td style={tdStyle}>{b.free_qty}</td>
                  <td style={tdStyle}>{b.required_qty}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={smallPrimaryButton} onClick={() => editRow(b)}>编辑</button>
                      <button style={smallDangerButton} onClick={() => deleteRow(b.id)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
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
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #f0e3d6',
}

const messageStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px solid #d8b99d',
}