'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

function num(v) {
  return Number(v || 0)
}

function text(v) {
  return (v || '').toString()
}

export default function BundleAdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [bundles, setBundles] = useState([])
  const [products, setProducts] = useState([])
  const [linkedProductIds, setLinkedProductIds] = useState([])

  const [selectedBundleId, setSelectedBundleId] = useState('')
  const [productSearch, setProductSearch] = useState('')

  const [form, setForm] = useState({
    id: '',
    name: '',
    brand: '',
    series: '',
    buy_qty: 10,
    free_qty: 1,
    min_select_qty: 11,
    bundle_price: 0,
    is_active: true,
  })

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (selectedBundleId) {
      loadLinkedProducts(selectedBundleId)
    } else {
      setLinkedProductIds([])
    }
  }, [selectedBundleId])

  async function loadAll() {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const { data: bundleRows, error: bundleError } = await supabase
        .from('bundle_rules')
        .select('id, name, brand, series, buy_qty, free_qty, min_select_qty, bundle_price, is_active, created_at')
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
        const first = bundleRows[0]
        handleSelectBundle(first)
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
        .select('product_id')
        .eq('bundle_rule_id', bundleId)

      if (error) throw error

      setLinkedProductIds((data || []).map((x) => x.product_id))
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
      is_active: true,
    })
    setSelectedBundleId('')
    setLinkedProductIds([])
    setSuccess('')
    setError('')
  }

  function handleSelectBundle(bundle) {
    setSelectedBundleId(bundle.id)
    setForm({
      id: bundle.id,
      name: bundle.name || '',
      brand: bundle.brand || '',
      series: bundle.series || '',
      buy_qty: num(bundle.buy_qty),
      free_qty: num(bundle.free_qty),
      min_select_qty: num(bundle.min_select_qty),
      bundle_price: num(bundle.bundle_price),
      is_active: !!bundle.is_active,
    })
    setSuccess('')
    setError('')
  }

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()

    let rows = [...products]

    if (form.brand.trim()) {
      rows = rows.filter((p) => text(p.brand) === form.brand.trim())
    }

    if (form.series.trim()) {
      rows = rows.filter((p) => text(p.series) === form.series.trim())
    }

    if (!q) return rows

    return rows.filter((p) => {
      const hay = [
        p.name,
        p.brand,
        p.series,
        p.flavor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return hay.includes(q)
    })
  }, [products, productSearch, form.brand, form.series])

  const selectedLinkedCount = useMemo(() => {
    return linkedProductIds.length
  }, [linkedProductIds])

  function toggleProduct(productId) {
    if (!selectedBundleId) return

    setLinkedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId)
      }
      return [...prev, productId]
    })
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

      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        series: form.series.trim(),
        buy_qty: num(form.buy_qty),
        free_qty: num(form.free_qty),
        min_select_qty: num(form.min_select_qty),
        bundle_price: num(form.bundle_price),
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
          .select('id, name, brand, series, buy_qty, free_qty, min_select_qty, bundle_price, is_active, created_at')
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
      if (!selectedBundleId) {
        setError('Please create or select a bundle first.')
        return
      }

      setSaving(true)
      setError('')
      setSuccess('')

      const { error: deleteError } = await supabase
        .from('bundle_rule_products')
        .delete()
        .eq('bundle_rule_id', selectedBundleId)

      if (deleteError) throw deleteError

      if (linkedProductIds.length > 0) {
        const insertRows = linkedProductIds.map((productId) => ({
          bundle_rule_id: selectedBundleId,
          product_id: productId,
        }))

        const { error: insertError } = await supabase
          .from('bundle_rule_products')
          .insert(insertRows)

        if (insertError) throw insertError
      }

      setSuccess('Bundle products saved.')
      await loadLinkedProducts(selectedBundleId)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to save bundle products.')
    } finally {
      setSaving(false)
    }
  }

  function autoFillSelectQty() {
    setForm((prev) => ({
      ...prev,
      min_select_qty: num(prev.buy_qty) + num(prev.free_qty),
    }))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow">
          Loading bundle admin...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">Bundle 后台管理</h1>
          <p className="mt-2 text-sm text-gray-500">
            创建 Bundle、编辑规则、绑定可选产品
          </p>
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-2xl bg-white p-6 shadow xl:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bundle 列表</h2>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                + New
              </button>
            </div>

            <div className="space-y-3">
              {bundles.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">
                  No bundle yet.
                </div>
              ) : (
                bundles.map((bundle) => {
                  const active = selectedBundleId === bundle.id
                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => handleSelectBundle(bundle)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 bg-white hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold">{bundle.name}</div>
                      <div className={`mt-1 text-sm ${active ? 'text-white/80' : 'text-gray-500'}`}>
                        {bundle.brand || '-'} / {bundle.series || '-'}
                      </div>
                      <div className={`mt-1 text-sm ${active ? 'text-white/80' : 'text-gray-500'}`}>
                        买 {bundle.buy_qty} 送 {bundle.free_qty} | 需选 {bundle.min_select_qty}
                      </div>
                      <div className={`mt-1 text-sm ${active ? 'text-white/80' : 'text-gray-500'}`}>
                        RM {num(bundle.bundle_price).toFixed(2)} | {bundle.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow xl:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {form.id ? '编辑 Bundle' : '新增 Bundle'}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Bundle Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="例如：SP2 1代 10送1"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Brand</label>
                <input
                  value={form.brand}
                  onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="例如：SP2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Series</label>
                <input
                  value={form.series}
                  onChange={(e) => setForm((prev) => ({ ...prev, series: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="例如：1代"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Buy Qty</label>
                  <input
                    type="number"
                    value={form.buy_qty}
                    onChange={(e) => setForm((prev) => ({ ...prev, buy_qty: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Free Qty</label>
                  <input
                    type="number"
                    value={form.free_qty}
                    onChange={(e) => setForm((prev) => ({ ...prev, free_qty: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Min Select Qty</label>
                  <input
                    type="number"
                    value={form.min_select_qty}
                    onChange={(e) => setForm((prev) => ({ ...prev, min_select_qty: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={autoFillSelectQty}
                  className="rounded-xl border px-3 py-2 text-sm"
                >
                  自动 = Buy Qty + Free Qty
                </button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Bundle Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.bundle_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, bundle_price: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="0.00"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveBundle}
                  disabled={saving}
                  className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
                >
                  {saving ? 'Saving...' : form.id ? 'Update Bundle' : 'Create Bundle'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border px-4 py-2 disabled:opacity-50"
                >
                  Reset
                </button>

                {form.id ? (
                  <button
                    type="button"
                    onClick={deleteBundle}
                    disabled={saving}
                    className="rounded-xl border border-red-300 px-4 py-2 text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow xl:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">绑定产品</h2>
              <div className="text-sm text-gray-500">
                已选 {selectedLinkedCount} 个
              </div>
            </div>

            {!selectedBundleId ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">
                请先创建或选择一个 bundle。
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="搜索产品 name / brand / series / flavor"
                  />

                  <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                    当前过滤：
                    <span className="ml-2 font-medium">
                      Brand = {form.brand || '全部'}
                    </span>
                    <span className="ml-3 font-medium">
                      Series = {form.series || '全部'}
                    </span>
                  </div>

                  <div className="max-h-[520px] space-y-2 overflow-auto rounded-xl border p-3">
                    {filteredProducts.length === 0 ? (
                      <div className="text-sm text-gray-500">没有符合条件的产品。</div>
                    ) : (
                      filteredProducts.map((product) => {
                        const checked = linkedProductIds.includes(product.id)

                        return (
                          <label
                            key={product.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                              checked ? 'border-black bg-gray-50' : 'border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(product.id)}
                              className="mt-1"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{product.name}</div>
                              <div className="mt-1 text-sm text-gray-500">
                                {product.brand || '-'} / {product.series || '-'} / {product.flavor || '-'}
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                Stock: {num(product.stock)} | {product.is_active ? 'Active' : 'Inactive'}
                              </div>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={saveLinkedProducts}
                    disabled={saving || !selectedBundleId}
                    className="w-full rounded-xl bg-black px-4 py-3 text-white disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Product Binding'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}