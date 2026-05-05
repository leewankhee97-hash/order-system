'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

function num(v) {
  return Number(v || 0)
}

function text(v) {
  return (v || '').toString()
}

const BUNDLE_TYPES = [
  {
    value: 'buy_x_get_y',
    label: '买X送Y',
    desc: '适合：买10送2、买10送1、买5送1',
  },
  {
    value: 'special_gift',
    label: '买送烟枪+烟弹',
    desc: '适合：买10送1烟枪+1盒烟弹',
  },
  {
    value: 'fixed_combo',
    label: '固定组合',
    desc: '适合：1盒烟弹+1支烟枪',
  },
]

const GIFT_MODES = [
  { value: 'none', label: '无赠品' },
  { value: 'pod', label: '送烟弹 / POD' },
  { value: 'device', label: '送烟枪 / DEVICE' },
  { value: 'pod_and_device', label: '送烟弹 + 烟枪' },
  { value: 'disposable', label: '送一次性 / DISPOSABLE' },
]

const GIFT_CHOOSE_MODES = [
  { value: 'none', label: '无' },
  { value: 'choose', label: '赠品可选' },
  { value: 'random', label: '赠品随机' },
  { value: 'partial_choose', label: '部分可选 + 部分随机' },
]

const PRODUCT_ROLES = [
  {
    value: 'main',
    label: '购买产品池',
    desc: '代理实际购买的产品，例如买10盒的口味',
  },
  {
    value: 'gift_pod',
    label: '赠品烟弹池',
    desc: '赠品烟弹可选时使用，会扣库存',
  },
  {
    value: 'gift_device',
    label: '赠品烟枪池',
    desc: '赠品烟枪可选时使用；如果随机赠品可以不用绑定',
  },
  {
    value: 'combo_pod',
    label: '组合烟弹',
    desc: '固定组合里的烟弹，例如 LANA POD',
  },
  {
    value: 'combo_device',
    label: '组合烟枪',
    desc: '固定组合里的烟枪，例如 LANA MATTE DEV',
  },
]

function roleInfo(role) {
  return PRODUCT_ROLES.find((r) => r.value === role) || PRODUCT_ROLES[0]
}

function cleanBindingRow(row) {
  return {
    id: row.id || '',
    bundle_rule_id: row.bundle_rule_id || '',
    product_id: row.product_id || '',
    role: row.role || 'main',
    qty_required: num(row.qty_required),
    is_gift: !!row.is_gift,
    choose_required: row.choose_required !== false,
    random_only: !!row.random_only,
  }
}

function getProductName(product) {
  return text(product?.name) || '-'
}

function getProductType(product) {
  const raw = text(
    product?.product_type ||
      product?.type ||
      product?.category ||
      product?.main_category ||
      ''
  ).toUpperCase()

  if (raw.includes('POD') || raw.includes('烟弹') || raw.includes('弹')) return '烟弹'
  if (raw.includes('DEVICE') || raw.includes('KIT') || raw.includes('烟杆') || raw.includes('杆')) return '烟杆'
  if (raw.includes('DISPOSABLE') || raw.includes('DISPO') || raw.includes('一次性')) return '一次性'

  return raw || '未分类'
}

export default function AdminBundlesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')

  const [bundles, setBundles] = useState([])
  const [products, setProducts] = useState([])
  const [bindings, setBindings] = useState([])

  const [editingId, setEditingId] = useState('')
  const [activeRole, setActiveRole] = useState('main')
  const [productSearch, setProductSearch] = useState('')

  const [form, setForm] = useState({
    name: '',
    brand: '',
    series: '',

    buy_qty: '10',
    free_qty: '1',
    min_select_qty: '11',

    bundle_price_1: '0',
    bundle_price_2: '0',
    bundle_price_3: '0',

    bundle_type: 'buy_x_get_y',
    gift_mode: 'pod',
    gift_choose_mode: 'choose',
    gift_note: '',
    display_tag: '',
    sort_order: '0',

    is_active: true,
  })

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    if (editingId) {
      fetchBindings(editingId)
    } else {
      setBindings([])
    }
  }, [editingId])

  async function fetchAll() {
    try {
      setLoading(true)
      setMessage('')

      const { data: bundleRows, error: bundleError } = await supabase
        .from('bundle_rules')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (bundleError) throw bundleError

      const { data: productRows, error: productError } = await supabase
        .from('products')
        .select('*')
        .order('brand', { ascending: true })
        .order('series', { ascending: true })
        .order('name', { ascending: true })

      if (productError) throw productError

      setBundles(bundleRows || [])
      setProducts(productRows || [])
    } catch (err) {
      console.error(err)
      showError(err.message || '读取资料失败')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBindings(bundleId) {
    try {
      const { data, error } = await supabase
        .from('bundle_rule_products')
        .select('*')
        .eq('bundle_rule_id', bundleId)

      if (error) throw error

      setBindings((data || []).map(cleanBindingRow))
    } catch (err) {
      console.error(err)
      showError(err.message || '读取绑定产品失败')
    }
  }

  function showSuccess(msg) {
    setMessageType('success')
    setMessage(msg)
  }

  function showError(msg) {
    setMessageType('error')
    setMessage(msg)
  }

  function handleChange(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }

      if (key === 'buy_qty' || key === 'free_qty') {
        const buy = Number(key === 'buy_qty' ? value : next.buy_qty || 0)
        const free = Number(key === 'free_qty' ? value : next.free_qty || 0)
        next.min_select_qty = String(buy + free)
      }

      return next
    })
  }

  function handleCheckboxChange(key, checked) {
    setForm((prev) => ({
      ...prev,
      [key]: checked,
    }))
  }

  function resetForm() {
    setEditingId('')
    setBindings([])
    setProductSearch('')
    setActiveRole('main')
    setMessage('')

    setForm({
      name: '',
      brand: '',
      series: '',

      buy_qty: '10',
      free_qty: '1',
      min_select_qty: '11',

      bundle_price_1: '0',
      bundle_price_2: '0',
      bundle_price_3: '0',

      bundle_type: 'buy_x_get_y',
      gift_mode: 'pod',
      gift_choose_mode: 'choose',
      gift_note: '',
      display_tag: '',
      sort_order: '0',

      is_active: true,
    })
  }

  function editRow(row) {
    setEditingId(row.id)
    setMessage('')
    setProductSearch('')
    setActiveRole('main')

    setForm({
      name: row.name || '',
      brand: row.brand || '',
      series: row.series || '',

      buy_qty: String(row.buy_qty ?? 10),
      free_qty: String(row.free_qty ?? 1),
      min_select_qty: String(
        row.min_select_qty ?? Number(row.buy_qty || 0) + Number(row.free_qty || 0)
      ),

      bundle_price_1: String(row.bundle_price_1 ?? 0),
      bundle_price_2: String(row.bundle_price_2 ?? 0),
      bundle_price_3: String(row.bundle_price_3 ?? 0),

      bundle_type: row.bundle_type || 'buy_x_get_y',
      gift_mode: row.gift_mode || 'none',
      gift_choose_mode: row.gift_choose_mode || 'none',
      gift_note: row.gift_note || '',
      display_tag: row.display_tag || '',
      sort_order: String(row.sort_order ?? 0),

      is_active: row.is_active ?? true,
    })
  }

  function applyQuickPreset(type) {
    if (type === 'buy10free2_choose') {
      setForm((prev) => ({
        ...prev,
        buy_qty: '10',
        free_qty: '2',
        min_select_qty: '12',
        bundle_type: 'buy_x_get_y',
        gift_mode: 'pod',
        gift_choose_mode: 'choose',
        display_tag: 'BUY 10 送 2',
        gift_note: '赠品口味可选',
      }))
      setActiveRole('main')
      return
    }

    if (type === 'buy10free1_random') {
      setForm((prev) => ({
        ...prev,
        buy_qty: '10',
        free_qty: '1',
        min_select_qty: '10',
        bundle_type: 'buy_x_get_y',
        gift_mode: 'pod',
        gift_choose_mode: 'random',
        display_tag: 'BUY 10 送 1',
        gift_note: '赠品随机发货',
      }))
      setActiveRole('main')
      return
    }

    if (type === 'buy10_pod_device') {
      setForm((prev) => ({
        ...prev,
        buy_qty: '10',
        free_qty: '2',
        min_select_qty: '11',
        bundle_type: 'special_gift',
        gift_mode: 'pod_and_device',
        gift_choose_mode: 'partial_choose',
        display_tag: 'BUY 10 送烟枪+烟弹',
        gift_note: '赠品烟弹可选，烟枪随机发货',
      }))
      setActiveRole('main')
      return
    }

    if (type === 'buy5free1_random') {
      setForm((prev) => ({
        ...prev,
        buy_qty: '5',
        free_qty: '1',
        min_select_qty: '5',
        bundle_type: 'buy_x_get_y',
        gift_mode: 'pod',
        gift_choose_mode: 'random',
        display_tag: 'BUY 5 送 1',
        gift_note: '赠品随机发货',
      }))
      setActiveRole('main')
      return
    }

    if (type === 'fixed_combo') {
      setForm((prev) => ({
        ...prev,
        buy_qty: '2',
        free_qty: '0',
        min_select_qty: '2',
        bundle_type: 'fixed_combo',
        gift_mode: 'none',
        gift_choose_mode: 'none',
        display_tag: '1盒烟弹 + 1支烟枪',
        gift_note: '组合产品都需要选择',
      }))
      setActiveRole('combo_pod')
    }
  }

  async function submitForm(e) {
    e.preventDefault()

    try {
      setSaving(true)
      setMessage('')

      const cleanName = String(form.name || '').trim()
      const cleanBrand = String(form.brand || '').trim()
      const cleanSeries = String(form.series || '').trim()

      const buyQty = Number(form.buy_qty || 0)
      const freeQty = Number(form.free_qty || 0)
      const minSelectQty = Number(form.min_select_qty || 0)

      const bundlePrice1 = Number(form.bundle_price_1 || 0)
      const bundlePrice2 = Number(form.bundle_price_2 || 0)
      const bundlePrice3 = Number(form.bundle_price_3 || 0)

      if (!cleanName) {
        showError('请填写 Bundle Name')
        return
      }

      if (!cleanBrand) {
        showError('请填写 Brand')
        return
      }

      if (buyQty < 0) {
        showError('Buy Qty 不能小于 0')
        return
      }

      if (freeQty < 0) {
        showError('Free Qty 不能小于 0')
        return
      }

      if (minSelectQty <= 0) {
        showError('Need Select 必须大于 0')
        return
      }

      const payload = {
        name: cleanName,
        brand: cleanBrand,
        series: cleanSeries || null,

        buy_qty: buyQty,
        free_qty: freeQty,
        min_select_qty: minSelectQty,

        bundle_price_1: bundlePrice1,
        bundle_price_2: bundlePrice2,
        bundle_price_3: bundlePrice3,

        bundle_type: form.bundle_type || 'buy_x_get_y',
        gift_mode: form.gift_mode || 'none',
        gift_choose_mode: form.gift_choose_mode || 'none',
        gift_note: String(form.gift_note || '').trim(),
        display_tag: String(form.display_tag || '').trim(),
        sort_order: Number(form.sort_order || 0),

        is_active: !!form.is_active,
        updated_at: new Date().toISOString(),
      }

      let bundleId = editingId

      if (editingId) {
        const { error } = await supabase
          .from('bundle_rules')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('bundle_rules')
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (error) throw error
        bundleId = data.id
        setEditingId(data.id)
      }

      await saveBindings(bundleId, false)

      showSuccess(editingId ? 'Bundle 已更新' : 'Bundle 已新增')
      await fetchAll()
      await fetchBindings(bundleId)
    } catch (err) {
      console.error(err)
      showError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveBindings(bundleId = editingId, showMsg = true) {
    if (!bundleId) {
      showError('请先新增或选择一个 Bundle')
      return
    }

    const { error: deleteError } = await supabase
      .from('bundle_rule_products')
      .delete()
      .eq('bundle_rule_id', bundleId)

    if (deleteError) throw deleteError

    if (bindings.length > 0) {
      const rows = bindings.map((row) => ({
        bundle_rule_id: bundleId,
        product_id: row.product_id,
        role: row.role || 'main',
        qty_required: num(row.qty_required),
        is_gift: !!row.is_gift,
        choose_required: row.choose_required !== false,
        random_only: !!row.random_only,
      }))

      const { error: insertError } = await supabase
        .from('bundle_rule_products')
        .insert(rows)

      if (insertError) throw insertError
    }

    if (showMsg) {
      showSuccess('产品绑定已保存')
      await fetchBindings(bundleId)
    }
  }

  async function handleSaveBindingsOnly() {
    try {
      setSaving(true)
      setMessage('')
      await saveBindings(editingId, true)
    } catch (err) {
      console.error(err)
      showError(err.message || '保存绑定产品失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRow(id) {
    const ok = window.confirm('确定删除这个 Bundle？')
    if (!ok) return

    try {
      setSaving(true)
      const { error } = await supabase.from('bundle_rules').delete().eq('id', id)

      if (error) throw error

      if (editingId === id) resetForm()

      showSuccess('Bundle 已删除')
      await fetchAll()
    } catch (err) {
      console.error(err)
      showError(err.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row) {
    try {
      const { error } = await supabase
        .from('bundle_rules')
        .update({
          is_active: !(row.is_active ?? true),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (error) throw error

      showSuccess(`Bundle 已${row.is_active ? '停用' : '启用'}`)
      await fetchAll()
    } catch (err) {
      console.error(err)
      showError(err.message || '更新状态失败')
    }
  }

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    let rows = [...products]

    if (form.brand.trim()) {
      rows = rows.filter((p) => text(p.brand).toLowerCase() === form.brand.trim().toLowerCase())
    }

    if (form.series.trim()) {
      rows = rows.filter((p) => text(p.series).toLowerCase() === form.series.trim().toLowerCase())
    }

    if (!q) return rows

    return rows.filter((p) => {
      const hay = [
        p.name,
        p.brand,
        p.series,
        p.flavor,
        p.product_type,
        p.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return hay.includes(q)
    })
  }, [products, productSearch, form.brand, form.series])

  const bindingStats = useMemo(() => {
    const stats = {}

    PRODUCT_ROLES.forEach((role) => {
      stats[role.value] = bindings.filter((item) => item.role === role.value).length
    })

    return stats
  }, [bindings])

  const selectedLinkedCount = useMemo(() => {
    return bindings.length
  }, [bindings])

  const currentRoleProducts = useMemo(() => {
    return bindings.filter((x) => x.role === activeRole).map((x) => x.product_id)
  }, [bindings, activeRole])

  function isProductChecked(productId, role = activeRole) {
    return bindings.some((x) => String(x.product_id) === String(productId) && x.role === role)
  }

  function getDefaultBindingOptions(role, productId) {
    if (role === 'main') {
      return {
        product_id: productId,
        role,
        qty_required: 0,
        is_gift: false,
        choose_required: true,
        random_only: false,
      }
    }

    if (role === 'gift_pod') {
      return {
        product_id: productId,
        role,
        qty_required: 0,
        is_gift: true,
        choose_required: true,
        random_only: false,
      }
    }

    if (role === 'gift_device') {
      return {
        product_id: productId,
        role,
        qty_required: 0,
        is_gift: true,
        choose_required: false,
        random_only:
          form.gift_choose_mode === 'random' ||
          form.gift_choose_mode === 'partial_choose',
      }
    }

    if (role === 'combo_pod') {
      return {
        product_id: productId,
        role,
        qty_required: 1,
        is_gift: false,
        choose_required: true,
        random_only: false,
      }
    }

    if (role === 'combo_device') {
      return {
        product_id: productId,
        role,
        qty_required: 1,
        is_gift: false,
        choose_required: true,
        random_only: false,
      }
    }

    return {
      product_id: productId,
      role,
      qty_required: 0,
      is_gift: false,
      choose_required: true,
      random_only: false,
    }
  }

  function toggleProduct(productId, role = activeRole) {
    if (!editingId) {
      showError('请先新增或选择一个 Bundle，然后再绑定产品')
      return
    }

    setBindings((prev) => {
      const exists = prev.some(
        (x) => String(x.product_id) === String(productId) && x.role === role
      )

      if (exists) {
        return prev.filter(
          (x) => !(String(x.product_id) === String(productId) && x.role === role)
        )
      }

      return [
        ...prev,
        {
          ...getDefaultBindingOptions(role, productId),
          bundle_rule_id: editingId,
        },
      ]
    })
  }

  function updateBinding(productId, role, patch) {
    setBindings((prev) =>
      prev.map((row) => {
        if (String(row.product_id) === String(productId) && row.role === role) {
          return {
            ...row,
            ...patch,
          }
        }

        return row
      })
    )
  }

  function getBundleTypeLabel(value) {
    return BUNDLE_TYPES.find((item) => item.value === value)?.label || value || '-'
  }

  function getGiftModeLabel(value) {
    return GIFT_MODES.find((item) => item.value === value)?.label || value || '-'
  }

  function getGiftChooseModeLabel(value) {
    return GIFT_CHOOSE_MODES.find((item) => item.value === value)?.label || value || '-'
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <div style={boxStyle}>Loading bundle admin...</div>
        </div>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={titleStyle}>Bundle 后台管理</h1>

        <div style={boxStyle}>
          <div style={{ marginBottom: 12, fontWeight: 900, fontSize: 18 }}>
            快速套用配套类型
          </div>

          <div style={quickGridStyle}>
            <button type="button" onClick={() => applyQuickPreset('buy10free2_choose')} style={secondaryButton}>
              买10送2｜赠品可选
            </button>

            <button type="button" onClick={() => applyQuickPreset('buy10free1_random')} style={secondaryButton}>
              买10送1｜随机赠品
            </button>

            <button type="button" onClick={() => applyQuickPreset('buy10_pod_device')} style={secondaryButton}>
              买10送烟枪+烟弹
            </button>

            <button type="button" onClick={() => applyQuickPreset('buy5free1_random')} style={secondaryButton}>
              买5送1
            </button>

            <button type="button" onClick={() => applyQuickPreset('fixed_combo')} style={secondaryButton}>
              固定组合｜1烟弹+1烟枪
            </button>
          </div>
        </div>

        <form onSubmit={submitForm} style={boxStyle}>
          <div style={sectionHeaderStyle}>
            {editingId ? '编辑 Bundle' : '新增 Bundle'}
          </div>

          <div style={formGridStyle}>
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
              placeholder="Series（可空，组合配套建议留空）"
              value={form.series}
              onChange={(e) => handleChange('series', e.target.value)}
              style={inputStyle}
            />

            <select
              value={form.bundle_type}
              onChange={(e) => handleChange('bundle_type', e.target.value)}
              style={inputStyle}
            >
              {BUNDLE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <input
              placeholder="Buy Qty"
              type="number"
              min="0"
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
              type="number"
              min="1"
              value={form.min_select_qty}
              onChange={(e) => handleChange('min_select_qty', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Sort Order"
              type="number"
              value={form.sort_order}
              onChange={(e) => handleChange('sort_order', e.target.value)}
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

            <select
              value={form.gift_mode}
              onChange={(e) => handleChange('gift_mode', e.target.value)}
              style={inputStyle}
            >
              {GIFT_MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={form.gift_choose_mode}
              onChange={(e) => handleChange('gift_choose_mode', e.target.value)}
              style={inputStyle}
            >
              {GIFT_CHOOSE_MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <input
              placeholder="Display Tag，例如 BUY 10 送 2"
              value={form.display_tag}
              onChange={(e) => handleChange('display_tag', e.target.value)}
              style={inputStyle}
            />

            <textarea
              placeholder="Gift Note，例如：赠品烟弹可选，烟枪随机发货"
              value={form.gift_note}
              onChange={(e) => handleChange('gift_note', e.target.value)}
              style={{
                ...inputStyle,
                height: 80,
                paddingTop: 12,
                gridColumn: 'span 2',
              }}
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

          <div style={previewStyle}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>当前规则预览</div>
            <div>类型：{getBundleTypeLabel(form.bundle_type)}</div>
            <div>赠品：{getGiftModeLabel(form.gift_mode)}</div>
            <div>选择方式：{getGiftChooseModeLabel(form.gift_choose_mode)}</div>
            <div>标签：{form.display_tag || '-'}</div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="submit" style={primaryButton} disabled={saving}>
              {saving ? '保存中...' : editingId ? '更新 Bundle' : '新增 Bundle'}
            </button>

            <button type="button" style={secondaryButton} onClick={resetForm} disabled={saving}>
              清空
            </button>
          </div>
        </form>

        {message ? (
          <div style={messageType === 'error' ? errorMessageStyle : successMessageStyle}>
            {message}
          </div>
        ) : null}

        <div style={layoutGridStyle}>
          <div style={boxStyle}>
            <div style={sectionHeaderStyle}>
              Bundle 列表
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[
                      'Name',
                      'Brand',
                      'Type',
                      'Tag',
                      'Buy',
                      'Free',
                      'Need Select',
                      'Price 1',
                      'Price 2',
                      'Price 3',
                      '状态',
                      '操作',
                    ].map((h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {bundles.map((b) => (
                    <tr key={b.id}>
                      <td style={tdStyle}>{b.name}</td>
                      <td style={tdStyle}>
                        <div>{b.brand}</div>
                        {b.series ? (
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{b.series}</div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>{getBundleTypeLabel(b.bundle_type)}</td>
                      <td style={tdStyle}>{b.display_tag || '-'}</td>
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
                        colSpan={12}
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

          <div style={boxStyle}>
            <div style={sectionHeaderStyle}>
              绑定产品角色
            </div>

            {!editingId ? (
              <div style={hintBoxStyle}>
                请先点击左边 Bundle 的【编辑】，或先新增 Bundle，才可以绑定产品。
              </div>
            ) : (
              <>
                <div style={roleGridStyle}>
                  {PRODUCT_ROLES.map((role) => {
                    const active = activeRole === role.value

                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setActiveRole(role.value)}
                        style={active ? activeRoleButtonStyle : roleButtonStyle}
                      >
                        <div style={{ fontWeight: 900 }}>{role.label}</div>
                        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.75 }}>
                          {role.desc}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900 }}>
                          已选 {bindingStats[role.value] || 0}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div style={previewStyle}>
                  <div style={{ fontWeight: 900 }}>
                    当前角色：{roleInfo(activeRole).label}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {roleInfo(activeRole).desc}
                  </div>
                </div>

                <input
                  placeholder="搜索产品 name / brand / series / flavor"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{
                    ...inputStyle,
                    marginBottom: 12,
                  }}
                />

                <div style={hintBoxStyle}>
                  当前过滤：Brand = <b>{form.brand || '全部'}</b>
                  {' ｜ '}
                  Series = <b>{form.series || '全部'}</b>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    如果找不到产品，可以先把 Series 清空，或确认 products.brand 是否完全一致。
                  </div>
                </div>

                <div style={productListStyle}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ color: '#9b7b63' }}>没有符合条件的产品。</div>
                  ) : (
                    filteredProducts.map((product) => {
                      const checked = isProductChecked(product.id, activeRole)
                      const binding = bindings.find(
                        (x) =>
                          String(x.product_id) === String(product.id) &&
                          x.role === activeRole
                      )

                      return (
                        <div
                          key={`${activeRole}-${product.id}`}
                          style={checked ? productCardActiveStyle : productCardStyle}
                        >
                          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(product.id, activeRole)}
                              style={{ marginTop: 4 }}
                            />

                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 900 }}>
                                {getProductName(product)}
                              </div>

                              <div style={{ fontSize: 13, marginTop: 4, color: '#8b6f5a' }}>
                                {getProductType(product)} / {product.brand || '-'} / {product.series || '-'} / {product.flavor || '-'}
                              </div>

                              <div style={{ fontSize: 13, marginTop: 4, color: '#8b6f5a' }}>
                                Stock: {Number(product.stock || 0)} | {product.is_active === false ? 'Inactive' : 'Active'}
                              </div>

                              {checked ? (
                                <div style={bindingOptionGridStyle}>
                                  <div>
                                    <label style={smallLabelStyle}>Qty Required</label>
                                    <input
                                      type="number"
                                      value={binding?.qty_required || 0}
                                      onChange={(e) =>
                                        updateBinding(product.id, activeRole, {
                                          qty_required: Number(e.target.value || 0),
                                        })
                                      }
                                      style={smallInputStyle}
                                    />
                                  </div>

                                  <label style={checkLabelStyle}>
                                    <input
                                      type="checkbox"
                                      checked={binding?.choose_required !== false}
                                      onChange={(e) =>
                                        updateBinding(product.id, activeRole, {
                                          choose_required: e.target.checked,
                                        })
                                      }
                                    />
                                    需要选择
                                  </label>

                                  <label style={checkLabelStyle}>
                                    <input
                                      type="checkbox"
                                      checked={!!binding?.random_only}
                                      onChange={(e) =>
                                        updateBinding(product.id, activeRole, {
                                          random_only: e.target.checked,
                                          choose_required: e.target.checked
                                            ? false
                                            : binding?.choose_required,
                                        })
                                      }
                                    />
                                    随机
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          </label>
                        </div>
                      )
                    })
                  )}
                </div>

                <div style={previewStyle}>
                  <div style={{ fontWeight: 900 }}>当前角色已选产品</div>
                  <div>
                    {currentRoleProducts.length === 0
                      ? '没有选择'
                      : `${currentRoleProducts.length} 个产品`}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveBindingsOnly}
                  disabled={saving || !editingId}
                  style={{
                    ...primaryButton,
                    width: '100%',
                    marginTop: 12,
                  }}
                >
                  {saving ? '保存中...' : '保存产品绑定'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f7efe7',
  padding: 24,
  color: '#6f4e37',
}

const containerStyle = {
  maxWidth: 1500,
  margin: '0 auto',
}

const titleStyle = {
  fontSize: 32,
  fontWeight: 900,
  marginBottom: 20,
}

const boxStyle = {
  background: '#fffaf5',
  border: '1px solid #ead7c4',
  borderRadius: 20,
  padding: 20,
  marginBottom: 20,
  overflowX: 'auto',
}

const sectionHeaderStyle = {
  fontSize: 20,
  fontWeight: 900,
  marginBottom: 14,
}

const quickGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
}

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const layoutGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)',
  gap: 20,
  alignItems: 'start',
}

const roleGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 10,
  marginBottom: 12,
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

const smallInputStyle = {
  width: '100%',
  height: 34,
  borderRadius: 10,
  border: '1px solid #d7bfa8',
  background: '#fff',
  padding: '0 8px',
  outline: 'none',
  color: '#6f4e37',
}

const smallLabelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 4,
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
  minHeight: 46,
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
  fontSize: 13,
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #f0e3d6',
  verticalAlign: 'middle',
  fontSize: 13,
}

const successMessageStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 14,
  background: '#edf9ed',
  border: '1px solid #b9ddb8',
  color: '#2f7a35',
  fontWeight: 800,
}

const errorMessageStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 14,
  background: '#fff3f3',
  border: '1px solid #e2c1c1',
  color: '#a14f4f',
  fontWeight: 800,
}

const previewStyle = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px solid #d8b99d',
  color: '#6f4e37',
  fontSize: 13,
}

const hintBoxStyle = {
  padding: 12,
  borderRadius: 14,
  background: '#fff8f1',
  border: '1px solid #ead7c4',
  color: '#8b6f5a',
  marginBottom: 12,
}

const roleButtonStyle = {
  border: '1px solid #ead7c4',
  background: '#fff8f1',
  color: '#6f4e37',
  borderRadius: 14,
  padding: 12,
  textAlign: 'left',
  cursor: 'pointer',
}

const activeRoleButtonStyle = {
  border: '1px solid #a47c57',
  background: '#a47c57',
  color: '#fff',
  borderRadius: 14,
  padding: 12,
  textAlign: 'left',
  cursor: 'pointer',
}

const productListStyle = {
  maxHeight: 580,
  overflowY: 'auto',
  border: '1px solid #ead7c4',
  borderRadius: 16,
  padding: 12,
  background: '#fffdfb',
}

const productCardStyle = {
  border: '1px solid #ead7c4',
  borderRadius: 14,
  padding: 12,
  marginBottom: 10,
  background: '#fff',
}

const productCardActiveStyle = {
  border: '1px solid #a47c57',
  borderRadius: 14,
  padding: 12,
  marginBottom: 10,
  background: '#fff8f1',
}

const bindingOptionGridStyle = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr 1fr',
  gap: 10,
  marginTop: 10,
  alignItems: 'center',
}

const checkLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
}