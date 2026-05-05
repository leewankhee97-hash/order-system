'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
    badge: 'MAIN',
    desc: '代理实际购买的产品，例如买10盒的口味',
  },
  {
    value: 'gift_pod',
    label: '赠品烟弹池',
    badge: 'GIFT POD',
    desc: '赠品烟弹可选时使用，会扣库存',
  },
  {
    value: 'gift_device',
    label: '赠品烟枪池',
    badge: 'GIFT DEVICE',
    desc: '赠品烟枪可选时使用；如果随机赠品可不选择具体产品',
  },
  {
    value: 'combo_pod',
    label: '组合烟弹',
    badge: 'COMBO POD',
    desc: '固定组合里的烟弹，例如 LANA POD',
  },
  {
    value: 'combo_device',
    label: '组合烟枪',
    badge: 'COMBO DEVICE',
    desc: '固定组合里的烟枪，例如 LANA MATTE DEV',
  },
]

function roleInfo(role) {
  return PRODUCT_ROLES.find((r) => r.value === role) || PRODUCT_ROLES[0]
}

function getPriceByLevel(bundle, level) {
  if (level === 1) return num(bundle.bundle_price_1 || bundle.bundle_price)
  if (level === 2) return num(bundle.bundle_price_2 || bundle.bundle_price)
  if (level === 3) return num(bundle.bundle_price_3 || bundle.bundle_price)
  return num(bundle.bundle_price || bundle.bundle_price_1)
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

export default function BundleAdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [bundles, setBundles] = useState([])
  const [products, setProducts] = useState([])
  const [bindings, setBindings] = useState([])

  const [selectedBundleId, setSelectedBundleId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [activeRole, setActiveRole] = useState('main')

  const [form, setForm] = useState({
    id: '',
    name: '',
    brand: '',
    series: '',

    buy_qty: 10,
    free_qty: 1,
    min_select_qty: 11,

    bundle_price: 0,
    bundle_price_1: 0,
    bundle_price_2: 0,
    bundle_price_3: 0,

    bundle_type: 'buy_x_get_y',
    gift_mode: 'pod',
    gift_choose_mode: 'choose',
    gift_note: '',
    display_tag: '',
    sort_order: 0,

    is_active: true,
  })

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (selectedBundleId) {
      loadLinkedProducts(selectedBundleId)
    } else {
      setBindings([])
    }
  }, [selectedBundleId])

  async function loadAll() {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const { data: bundleRows, error: bundleError } = await supabase
        .from('bundle_rules')
        .select(`
          id,
          name,
          brand,
          series,
          buy_qty,
          free_qty,
          min_select_qty,
          bundle_price,
          bundle_price_1,
          bundle_price_2,
          bundle_price_3,
          bundle_type,
          gift_mode,
          gift_choose_mode,
          gift_note,
          display_tag,
          sort_order,
          is_active,
          created_at
        `)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (bundleError) throw bundleError

      const { data: productRows, error: productError } = await supabase
        .from('products')
        .select('id, name, brand, series, flavor, stock, is_active')
        .order('brand', { ascending: true })
        .order('series', { ascending: true })
        .order('name', { ascending: true })

      if (productError) throw productError

      setBundles(bundleRows || [])
      setProducts(productRows || [])

      if ((bundleRows || []).length > 0 && !selectedBundleId) {
        handleSelectBundle(bundleRows[0])
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  async function loadLinkedProducts(bundleId) {
    try {
      setError('')

      const { data, error } = await supabase
        .from('bundle_rule_products')
        .select(`
          id,
          bundle_rule_id,
          product_id,
          role,
          qty_required,
          is_gift,
          choose_required,
          random_only
        `)
        .eq('bundle_rule_id', bundleId)

      if (error) throw error

      setBindings((data || []).map(cleanBindingRow))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load linked products.')
    }
  }

  function resetForm() {
    setForm({
      id: '',
      name: '',
      brand: '',
      series: '',

      buy_qty: 10,
      free_qty: 1,
      min_select_qty: 11,

      bundle_price: 0,
      bundle_price_1: 0,
      bundle_price_2: 0,
      bundle_price_3: 0,

      bundle_type: 'buy_x_get_y',
      gift_mode: 'pod',
      gift_choose_mode: 'choose',
      gift_note: '',
      display_tag: '',
      sort_order: 0,

      is_active: true,
    })

    setSelectedBundleId('')
    setBindings([])
    setProductSearch('')
    setActiveRole('main')
    setSuccess('')
    setError('')
  }

  function handleSelectBundle(bundle) {
    const fallbackPrice = num(bundle.bundle_price || bundle.bundle_price_1)

    setSelectedBundleId(bundle.id)
    setForm({
      id: bundle.id,
      name: bundle.name || '',
      brand: bundle.brand || '',
      series: bundle.series || '',

      buy_qty: num(bundle.buy_qty),
      free_qty: num(bundle.free_qty),
      min_select_qty: num(bundle.min_select_qty),

      bundle_price: fallbackPrice,
      bundle_price_1: num(bundle.bundle_price_1 || fallbackPrice),
      bundle_price_2: num(bundle.bundle_price_2 || fallbackPrice),
      bundle_price_3: num(bundle.bundle_price_3 || fallbackPrice),

      bundle_type: bundle.bundle_type || 'buy_x_get_y',
      gift_mode: bundle.gift_mode || 'none',
      gift_choose_mode: bundle.gift_choose_mode || 'none',
      gift_note: bundle.gift_note || '',
      display_tag: bundle.display_tag || '',
      sort_order: num(bundle.sort_order),

      is_active: !!bundle.is_active,
    })

    setProductSearch('')
    setSuccess('')
    setError('')
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
      const hay = [p.name, p.brand, p.series, p.flavor]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return hay.includes(q)
    })
  }, [products, productSearch, form.brand, form.series])

  const bindingStats = useMemo(() => {
    const stats = {}

    for (const role of PRODUCT_ROLES) {
      stats[role.value] = bindings.filter((x) => x.role === role.value).length
    }

    return stats
  }, [bindings])

  const selectedLinkedCount = useMemo(() => {
    return bindings.length
  }, [bindings])

  const currentRoleProducts = useMemo(() => {
    return bindings.filter((x) => x.role === activeRole).map((x) => x.product_id)
  }, [bindings, activeRole])

  function isProductChecked(productId, role = activeRole) {
    return bindings.some((x) => x.product_id === productId && x.role === role)
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
        random_only: form.gift_choose_mode === 'random' || form.gift_choose_mode === 'partial_choose',
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
    if (!selectedBundleId && !form.id) {
      setError('Please create or select a bundle first.')
      return
    }

    setBindings((prev) => {
      const exists = prev.some((x) => x.product_id === productId && x.role === role)

      if (exists) {
        return prev.filter((x) => !(x.product_id === productId && x.role === role))
      }

      return [
        ...prev,
        {
          ...getDefaultBindingOptions(role, productId),
          bundle_rule_id: selectedBundleId || form.id,
        },
      ]
    })
  }

  function updateBinding(productId, role, patch) {
    setBindings((prev) =>
      prev.map((row) => {
        if (row.product_id === productId && row.role === role) {
          return {
            ...row,
            ...patch,
          }
        }
        return row
      })
    )
  }

  async function saveBundle() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      if (!form.name.trim()) {
        setError('Bundle name is required.')
        return
      }

      if (!form.brand.trim()) {
        setError('Brand is required.')
        return
      }

      if (!form.series.trim()) {
        setError('Series is required.')
        return
      }

      if (num(form.buy_qty) < 0 || num(form.free_qty) < 0 || num(form.min_select_qty) <= 0) {
        setError('Quantity fields are invalid.')
        return
      }

      const price1 = num(form.bundle_price_1 || form.bundle_price)
      const price2 = num(form.bundle_price_2 || form.bundle_price)
      const price3 = num(form.bundle_price_3 || form.bundle_price)
      const fallbackPrice = price1 || num(form.bundle_price)

      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        series: form.series.trim(),

        buy_qty: num(form.buy_qty),
        free_qty: num(form.free_qty),
        min_select_qty: num(form.min_select_qty),

        bundle_price: fallbackPrice,
        bundle_price_1: price1,
        bundle_price_2: price2,
        bundle_price_3: price3,

        bundle_type: form.bundle_type || 'buy_x_get_y',
        gift_mode: form.gift_mode || 'none',
        gift_choose_mode: form.gift_choose_mode || 'none',
        gift_note: form.gift_note.trim(),
        display_tag: form.display_tag.trim(),
        sort_order: num(form.sort_order),

        is_active: !!form.is_active,
      }

      if (form.id) {
        const { error } = await supabase
          .from('bundle_rules')
          .update(payload)
          .eq('id', form.id)

        if (error) throw error

        setSuccess('Bundle updated.')
      } else {
        const { data, error } = await supabase
          .from('bundle_rules')
          .insert(payload)
          .select(`
            id,
            name,
            brand,
            series,
            buy_qty,
            free_qty,
            min_select_qty,
            bundle_price,
            bundle_price_1,
            bundle_price_2,
            bundle_price_3,
            bundle_type,
            gift_mode,
            gift_choose_mode,
            gift_note,
            display_tag,
            sort_order,
            is_active,
            created_at
          `)
          .single()

        if (error) throw error

        setSuccess('Bundle created.')
        setSelectedBundleId(data.id)

        setForm({
          id: data.id,
          name: data.name || '',
          brand: data.brand || '',
          series: data.series || '',

          buy_qty: num(data.buy_qty),
          free_qty: num(data.free_qty),
          min_select_qty: num(data.min_select_qty),

          bundle_price: num(data.bundle_price),
          bundle_price_1: num(data.bundle_price_1 || data.bundle_price),
          bundle_price_2: num(data.bundle_price_2 || data.bundle_price),
          bundle_price_3: num(data.bundle_price_3 || data.bundle_price),

          bundle_type: data.bundle_type || 'buy_x_get_y',
          gift_mode: data.gift_mode || 'none',
          gift_choose_mode: data.gift_choose_mode || 'none',
          gift_note: data.gift_note || '',
          display_tag: data.display_tag || '',
          sort_order: num(data.sort_order),

          is_active: !!data.is_active,
        })
      }

      await loadAll()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to save bundle.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBundle() {
    try {
      if (!form.id) {
        setError('Please select a bundle first.')
        return
      }

      const ok = window.confirm(`Delete bundle "${form.name}" ?`)
      if (!ok) return

      setSaving(true)
      setError('')
      setSuccess('')

      const { error } = await supabase
        .from('bundle_rules')
        .delete()
        .eq('id', form.id)

      if (error) throw error

      setSuccess('Bundle deleted.')
      resetForm()
      await loadAll()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to delete bundle.')
    } finally {
      setSaving(false)
    }
  }

  async function saveLinkedProducts() {
    try {
      if (!selectedBundleId && !form.id) {
        setError('Please create or select a bundle first.')
        return
      }

      const bundleId = selectedBundleId || form.id

      setSaving(true)
      setError('')
      setSuccess('')

      const { error: deleteError } = await supabase
        .from('bundle_rule_products')
        .delete()
        .eq('bundle_rule_id', bundleId)

      if (deleteError) throw deleteError

      if (bindings.length > 0) {
        const insertRows = bindings.map((row) => ({
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
          .insert(insertRows)

        if (insertError) throw insertError
      }

      setSuccess('Bundle products saved.')
      await loadLinkedProducts(bundleId)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to save bundle products.')
    } finally {
      setSaving(false)
    }
  }

  async function saveAll() {
    await saveBundle()

    setTimeout(async () => {
      if (selectedBundleId || form.id) {
        await saveLinkedProducts()
      }
    }, 300)
  }

  function autoFillSelectQty() {
    setForm((prev) => ({
      ...prev,
      min_select_qty: num(prev.buy_qty) + num(prev.free_qty),
    }))
  }

  function applyQuickPreset(preset) {
    if (preset === 'buy10free2_choose') {
      setForm((prev) => ({
        ...prev,
        buy_qty: 10,
        free_qty: 2,
        min_select_qty: 12,
        bundle_type: 'buy_x_get_y',
        gift_mode: 'pod',
        gift_choose_mode: 'choose',
        display_tag: 'BUY 10 送 2',
        gift_note: '赠品口味可选',
      }))
      setActiveRole('main')
      return
    }

    if (preset === 'buy10free1_random') {
      setForm((prev) => ({
        ...prev,
        buy_qty: 10,
        free_qty: 1,
        min_select_qty: 10,
        bundle_type: 'buy_x_get_y',
        gift_mode: 'device',
        gift_choose_mode: 'random',
        display_tag: 'BUY 10 送 1',
        gift_note: '赠品随机发货',
      }))
      setActiveRole('main')
      return
    }

    if (preset === 'buy10_pod_device') {
      setForm((prev) => ({
        ...prev,
        buy_qty: 10,
        free_qty: 2,
        min_select_qty: 11,
        bundle_type: 'special_gift',
        gift_mode: 'pod_and_device',
        gift_choose_mode: 'partial_choose',
        display_tag: 'BUY 10 送烟枪+烟弹',
        gift_note: '赠品烟弹可选，烟枪随机发货',
      }))
      setActiveRole('main')
      return
    }

    if (preset === 'buy5free1_random') {
      setForm((prev) => ({
        ...prev,
        buy_qty: 5,
        free_qty: 1,
        min_select_qty: 5,
        bundle_type: 'buy_x_get_y',
        gift_mode: 'pod',
        gift_choose_mode: 'random',
        display_tag: 'BUY 5 送 1',
        gift_note: '赠品随机发货',
      }))
      setActiveRole('main')
      return
    }

    if (preset === 'fixed_combo') {
      setForm((prev) => ({
        ...prev,
        buy_qty: 2,
        free_qty: 0,
        min_select_qty: 2,
        bundle_type: 'fixed_combo',
        gift_mode: 'none',
        gift_choose_mode: 'none',
        display_tag: '1盒烟弹 + 1支烟枪',
        gift_note: '组合产品都需要选择',
      }))
      setActiveRole('combo_pod')
    }
  }

  function getBundleTypeLabel(value) {
    return BUNDLE_TYPES.find((x) => x.value === value)?.label || value
  }

  function getGiftModeLabel(value) {
    return GIFT_MODES.find((x) => x.value === value)?.label || value
  }

  function getGiftChooseModeLabel(value) {
    return GIFT_CHOOSE_MODES.find((x) => x.value === value)?.label || value
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f1e8] p-6">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow">
          Loading bundle admin...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f1e8] p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-3xl border border-[#ead8c5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#4b3425]">Bundle 后台管理</h1>
              <p className="mt-2 text-sm text-[#8b6f5a]">
                支持买10送2、买10送1随机、买10送烟枪+烟弹、买5送1、固定组合。
              </p>
            </div>

            <div className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm text-[#7c5a3e]">
              已选产品绑定：<span className="font-bold">{selectedLinkedCount}</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
            {success}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="rounded-3xl border border-[#ead8c5] bg-white p-4 shadow-sm xl:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#4b3425]">Bundle 列表</h2>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-[#d8bfa7] bg-[#fff7ed] px-3 py-2 text-sm font-semibold text-[#6b4b35]"
              >
                + New
              </button>
            </div>

            <div className="space-y-3">
              {bundles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d8bfa7] p-4 text-sm text-[#8b6f5a]">
                  No bundle yet.
                </div>
              ) : (
                bundles.map((bundle) => {
                  const active = selectedBundleId === bundle.id
                  const price1 = getPriceByLevel(bundle, 1)

                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => handleSelectBundle(bundle)}
                      className={`w-full rounded-3xl border p-4 text-left transition ${
                        active
                          ? 'border-[#4b3425] bg-[#4b3425] text-white'
                          : 'border-[#ead8c5] bg-white hover:border-[#b98b64]'
                      }`}
                    >
                      <div className="font-bold">{bundle.name}</div>

                      <div className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-[#8b6f5a]'}`}>
                        {bundle.brand || '-'} / {bundle.series || '-'}
                      </div>

                      <div className={`mt-2 text-xs ${active ? 'text-white/80' : 'text-[#8b6f5a]'}`}>
                        {getBundleTypeLabel(bundle.bundle_type || 'buy_x_get_y')}
                      </div>

                      <div className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-[#8b6f5a]'}`}>
                        {bundle.display_tag || `买 ${bundle.buy_qty} 送 ${bundle.free_qty}`}
                      </div>

                      <div className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-[#8b6f5a]'}`}>
                        RM {price1.toFixed(2)} | {bundle.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#ead8c5] bg-white p-4 shadow-sm xl:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#4b3425]">
                {form.id ? '编辑 Bundle' : '新增 Bundle'}
              </h2>
            </div>

            <div className="mb-5 rounded-3xl bg-[#fff7ed] p-4">
              <div className="mb-3 text-sm font-bold text-[#6b4b35]">快速套用配套类型</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => applyQuickPreset('buy10free2_choose')}
                  className="rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6b4b35]"
                >
                  买10送2｜赠品可选
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickPreset('buy10free1_random')}
                  className="rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6b4b35]"
                >
                  买10送1｜随机赠品
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickPreset('buy10_pod_device')}
                  className="rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6b4b35]"
                >
                  买10送烟枪+烟弹
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickPreset('buy5free1_random')}
                  className="rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6b4b35]"
                >
                  买5送1
                </button>

                <button
                  type="button"
                  onClick={() => applyQuickPreset('fixed_combo')}
                  className="rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6b4b35] sm:col-span-2"
                >
                  固定组合｜1烟弹+1烟枪
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                  Bundle Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  placeholder="例如：SP2 一代 POD 买10送2"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">Brand</label>
                  <input
                    value={form.brand}
                    onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                    placeholder="例如：SP2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">Series</label>
                  <input
                    value={form.series}
                    onChange={(e) => setForm((prev) => ({ ...prev, series: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                    placeholder="例如：SP2 I POD"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4b3425]">Bundle Type</label>
                <select
                  value={form.bundle_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, bundle_type: e.target.value }))}
                  className="w-full rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 outline-none focus:border-[#8b5e3c]"
                >
                  {BUNDLE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-[#8b6f5a]">
                  {BUNDLE_TYPES.find((x) => x.value === form.bundle_type)?.desc}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">Buy Qty</label>
                  <input
                    type="number"
                    value={form.buy_qty}
                    onChange={(e) => setForm((prev) => ({ ...prev, buy_qty: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">Free Qty</label>
                  <input
                    type="number"
                    value={form.free_qty}
                    onChange={(e) => setForm((prev) => ({ ...prev, free_qty: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                    Min Select
                  </label>
                  <input
                    type="number"
                    value={form.min_select_qty}
                    onChange={(e) => setForm((prev) => ({ ...prev, min_select_qty: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={autoFillSelectQty}
                className="w-fit rounded-2xl border border-[#d8bfa7] bg-[#fff7ed] px-3 py-2 text-sm font-semibold text-[#6b4b35]"
              >
                自动 = Buy Qty + Free Qty
              </button>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                    Price 1
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.bundle_price_1}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bundle_price_1: e.target.value,
                        bundle_price: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                    Price 2
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.bundle_price_2}
                    onChange={(e) => setForm((prev) => ({ ...prev, bundle_price_2: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                    Price 3
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.bundle_price_3}
                    onChange={(e) => setForm((prev) => ({ ...prev, bundle_price_3: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                    Gift Mode
                  </label>
                  <select
                    value={form.gift_mode}
                    onChange={(e) => setForm((prev) => ({ ...prev, gift_mode: e.target.value }))}
                    className="w-full rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  >
                    {GIFT_MODES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                    Gift Choose
                  </label>
                  <select
                    value={form.gift_choose_mode}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, gift_choose_mode: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-[#d8bfa7] bg-white px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  >
                    {GIFT_CHOOSE_MODES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                  Display Tag
                </label>
                <input
                  value={form.display_tag}
                  onChange={(e) => setForm((prev) => ({ ...prev, display_tag: e.target.value }))}
                  className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  placeholder="例如：BUY 10 送 2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                  Gift Note
                </label>
                <textarea
                  value={form.gift_note}
                  onChange={(e) => setForm((prev) => ({ ...prev, gift_note: e.target.value }))}
                  className="min-h-[78px] w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  placeholder="例如：赠品烟弹可选，烟枪随机发货"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#4b3425]">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-bold text-[#4b3425]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>

              <div className="rounded-3xl bg-[#fff7ed] p-4 text-sm text-[#6b4b35]">
                <div className="font-bold">当前规则预览</div>
                <div className="mt-2 space-y-1">
                  <div>类型：{getBundleTypeLabel(form.bundle_type)}</div>
                  <div>赠品：{getGiftModeLabel(form.gift_mode)}</div>
                  <div>选择方式：{getGiftChooseModeLabel(form.gift_choose_mode)}</div>
                  <div>标签：{form.display_tag || '-'}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveBundle}
                  disabled={saving}
                  className="rounded-2xl bg-[#4b3425] px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving...' : form.id ? 'Update Bundle' : 'Create Bundle'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-2xl border border-[#d8bfa7] px-4 py-2 font-semibold text-[#6b4b35] disabled:opacity-50"
                >
                  Reset
                </button>

                {form.id ? (
                  <button
                    type="button"
                    onClick={deleteBundle}
                    disabled={saving}
                    className="rounded-2xl border border-red-300 px-4 py-2 font-semibold text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#ead8c5] bg-white p-4 shadow-sm xl:col-span-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#4b3425]">绑定产品角色</h2>
                <p className="mt-1 text-sm text-[#8b6f5a]">
                  同一个产品可以同时放在购买池和赠品池。
                </p>
              </div>

              <div className="rounded-2xl bg-[#fff7ed] px-3 py-2 text-sm font-bold text-[#6b4b35]">
                总数 {selectedLinkedCount}
              </div>
            </div>

            {!selectedBundleId ? (
              <div className="rounded-2xl border border-dashed border-[#d8bfa7] p-4 text-sm text-[#8b6f5a]">
                请先创建或选择一个 bundle。
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PRODUCT_ROLES.map((role) => {
                    const active = activeRole === role.value

                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setActiveRole(role.value)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          active
                            ? 'border-[#4b3425] bg-[#4b3425] text-white'
                            : 'border-[#ead8c5] bg-white text-[#6b4b35]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">{role.label}</span>
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              active ? 'bg-white/20 text-white' : 'bg-[#fff7ed] text-[#8b5e3c]'
                            }`}
                          >
                            {bindingStats[role.value] || 0}
                          </span>
                        </div>
                        <div className={`mt-1 text-xs ${active ? 'text-white/75' : 'text-[#8b6f5a]'}`}>
                          {role.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-3xl bg-[#fff7ed] p-4">
                  <div className="text-sm font-bold text-[#4b3425]">
                    当前角色：{roleInfo(activeRole).label}
                  </div>
                  <div className="mt-1 text-xs text-[#8b6f5a]">
                    {roleInfo(activeRole).desc}
                  </div>
                </div>

                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full rounded-2xl border border-[#d8bfa7] px-3 py-2 outline-none focus:border-[#8b5e3c]"
                  placeholder="搜索产品 name / brand / series / flavor"
                />

                <div className="rounded-2xl bg-[#fff7ed] p-3 text-sm text-[#6b4b35]">
                  当前过滤：
                  <span className="ml-2 font-bold">
                    Brand = {form.brand || '全部'}
                  </span>
                  <span className="ml-3 font-bold">
                    Series = {form.series || '全部'}
                  </span>
                  <div className="mt-1 text-xs text-[#8b6f5a]">
                    这里会跟着 Bundle 的 Brand / Series 过滤。想看全部产品，可以先把 Brand / Series 清空。
                  </div>
                </div>

                <div className="max-h-[560px] space-y-2 overflow-auto rounded-2xl border border-[#ead8c5] p-3">
                  {filteredProducts.length === 0 ? (
                    <div className="text-sm text-[#8b6f5a]">没有符合条件的产品。</div>
                  ) : (
                    filteredProducts.map((product) => {
                      const checked = isProductChecked(product.id, activeRole)
                      const binding = bindings.find(
                        (x) => x.product_id === product.id && x.role === activeRole
                      )

                      return (
                        <div
                          key={`${activeRole}-${product.id}`}
                          className={`rounded-2xl border p-3 ${
                            checked ? 'border-[#4b3425] bg-[#fff7ed]' : 'border-[#ead8c5] bg-white'
                          }`}
                        >
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(product.id, activeRole)}
                              className="mt-1"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[#4b3425]">{product.name}</div>
                              <div className="mt-1 text-sm text-[#8b6f5a]">
                                {product.brand || '-'} / {product.series || '-'} / {product.flavor || '-'}
                              </div>
                              <div className="mt-1 text-sm text-[#8b6f5a]">
                                Stock: {num(product.stock)} | {product.is_active ? 'Active' : 'Inactive'}
                              </div>

                              {checked ? (
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                  <div>
                                    <label className="mb-1 block text-xs font-bold text-[#6b4b35]">
                                      Qty Required
                                    </label>
                                    <input
                                      type="number"
                                      value={binding?.qty_required || 0}
                                      onChange={(e) =>
                                        updateBinding(product.id, activeRole, {
                                          qty_required: num(e.target.value),
                                        })
                                      }
                                      className="w-full rounded-xl border border-[#d8bfa7] px-2 py-1 text-sm"
                                    />
                                  </div>

                                  <label className="flex items-center gap-2 text-xs font-bold text-[#6b4b35]">
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

                                  <label className="flex items-center gap-2 text-xs font-bold text-[#6b4b35]">
                                    <input
                                      type="checkbox"
                                      checked={!!binding?.random_only}
                                      onChange={(e) =>
                                        updateBinding(product.id, activeRole, {
                                          random_only: e.target.checked,
                                          choose_required: e.target.checked ? false : binding?.choose_required,
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

                <div className="rounded-3xl bg-[#fff7ed] p-4 text-sm text-[#6b4b35]">
                  <div className="font-bold">当前角色已选产品</div>
                  <div className="mt-1">
                    {currentRoleProducts.length === 0
                      ? '没有选择'
                      : `${currentRoleProducts.length} 个产品`}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveLinkedProducts}
                  disabled={saving || !selectedBundleId}
                  className="w-full rounded-2xl bg-[#4b3425] px-4 py-3 font-bold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Product Binding'}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}