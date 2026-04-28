'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PRODUCT_TYPES = ['烟弹', '烟杆', '一次性']

const emptyForm = {
  product_type: '烟弹',
  brand: '',
  series: '',
  flavor: '',
  name: '',
  sku: '',
  price_1: '',
  price_2: '',
  price_3: '',
  stock: '',
  cost: '',
}

const emptyBulkForm = {
  product_type: '烟弹',
  brand: '',
  series: '',
  price_1: '',
  price_2: '',
  price_3: '',
  stock: '',
  flavorsText: '',
  cost: '',
}

const emptySeriesPriceForm = {
  brand: '',
  series: '',
  price_1: '',
  price_2: '',
  price_3: '',
   cost: '', // 🔥 加这个
}

const emptyFilters = {
  product_type: '',
  brand: '',
  series: '',
  flavor: '',
}

function makeSku(brand, series, flavor) {
  return `${brand || ''}-${series || ''}-${flavor || ''}`
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .toUpperCase()
}

function makeName(flavor) {
  return String(flavor || '').trim()
}

function getVariantLabel(productType) {
  return productType === '烟杆' ? '颜色' : '口味'
}

function uniqueSorted(arr) {
  return [...new Set((arr || []).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), 'zh-Hans-CN', { sensitivity: 'base' })
  )
}

function stockStatus(stock) {
  const s = Number(stock || 0)

  if (s <= 0) {
    return {
      text: 'OUT',
      color: '#dc2626',
      bg: '#fff1f2',
      border: '#fecdd3',
    }
  }

  if (s <= 10) {
    return {
      text: 'VERY LOW',
      color: '#dc2626',
      bg: '#fff7ed',
      border: '#fdba74',
    }
  }

  if (s <= 30) {
    return {
      text: 'LOW',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fcd34d',
    }
  }

  return {
    text: 'IN',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
  }
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [bulkForm, setBulkForm] = useState(emptyBulkForm)
  const [seriesPriceForm, setSeriesPriceForm] = useState(emptySeriesPriceForm)
  const [filters, setFilters] = useState(emptyFilters)
  const [editingId, setEditingId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [seriesSaving, setSeriesSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [search, setSearch] = useState('')
  const [restockingId, setRestockingId] = useState('')
  const [stockSavingId, setStockSavingId] = useState('')
  const [stockInputs, setStockInputs] = useState({})

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 1100)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function fetchProducts() {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('product_type', { ascending: true })
      .order('brand', { ascending: true })
      .order('series', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      setMessage(error.message)
    } else {
      setProducts(data || [])
    }

    setLoading(false)
  }

  const filterProductTypeOptions = useMemo(() => {
    return uniqueSorted(products.map((p) => p.product_type))
  }, [products])

  const filterBrandOptions = useMemo(() => {
    return uniqueSorted(
      products
        .filter((p) => !filters.product_type || p.product_type === filters.product_type)
        .map((p) => p.brand)
    )
  }, [products, filters.product_type])

  const filterSeriesOptions = useMemo(() => {
    return uniqueSorted(
      products
        .filter((p) => !filters.product_type || p.product_type === filters.product_type)
        .filter((p) => !filters.brand || p.brand === filters.brand)
        .map((p) => p.series)
    )
  }, [products, filters.product_type, filters.brand])

  const filterFlavorOptions = useMemo(() => {
    return uniqueSorted(
      products
        .filter((p) => !filters.product_type || p.product_type === filters.product_type)
        .filter((p) => !filters.brand || p.brand === filters.brand)
        .filter((p) => !filters.series || p.series === filters.series)
        .map((p) => p.flavor)
    )
  }, [products, filters.product_type, filters.brand, filters.series])

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return products.filter((p) => {
      if (filters.product_type && p.product_type !== filters.product_type) return false
      if (filters.brand && p.brand !== filters.brand) return false
      if (filters.series && p.series !== filters.series) return false
      if (filters.flavor && p.flavor !== filters.flavor) return false

      if (keyword) {
        const target = [
          p.product_type,
          p.brand,
          p.series,
          p.flavor,
          p.name,
          p.sku,
          String(p.price_1 ?? ''),
          String(p.price_2 ?? ''),
          String(p.price_3 ?? ''),
          String(p.stock ?? ''),
          stockStatus(p.stock).text,
        ]
          .join(' ')
          .toLowerCase()

        if (!target.includes(keyword)) return false
      }

      return true
    })
  }, [products, filters, search])

  const stockStats = useMemo(() => {
    const out = products.filter((p) => Number(p.stock || 0) <= 0).length
    const veryLow = products.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 10).length
    const low = products.filter((p) => Number(p.stock || 0) > 10 && Number(p.stock || 0) <= 30).length
    const inStock = products.filter((p) => Number(p.stock || 0) > 30).length

    return { out, veryLow, low, inStock }
  }, [products])

  function handleChange(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }

      if (key === 'product_type' && next.name.trim() === '') {
        next.name = ''
      }

      return next
    })
  }

  function handleBulkChange(key, value) {
    setBulkForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSeriesPriceChange(key, value) {
    setSeriesPriceForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }

      if (key === 'product_type') {
        next.brand = ''
        next.series = ''
        next.flavor = ''
      }

      if (key === 'brand') {
        next.series = ''
        next.flavor = ''
      }

      if (key === 'series') {
        next.flavor = ''
      }

      return next
    })
  }

  function handleEdit(product) {
    setEditingId(product.id)
    setForm({
      product_type: product.product_type || '烟弹',
      brand: product.brand || '',
      series: product.series || '',
      flavor: product.flavor || '',
      name: product.name || '',
      sku: product.sku || '',
      price_1: product.price_1 ?? '',
      price_2: product.price_2 ?? '',
      price_3: product.price_3 ?? '',
      stock: product.stock ?? '',
      cost: product.cost ?? '',
    })
    setMessage('')
    setActiveTab('single')

    setTimeout(() => {
      const el = document.getElementById('single-form-panel')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)
  }

  function handleEditSeriesPrice(product) {
    setSeriesPriceForm({
      brand: product.brand || '',
      series: product.series || '',
      price_1: product.price_1 ?? '',
      price_2: product.price_2 ?? '',
      price_3: product.price_3 ?? '',
    })
    setMessage('')
    setActiveTab('bulk')

    setTimeout(() => {
      const el = document.getElementById('series-price-panel')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)
  }

  function handleReset() {
    setEditingId('')
    setForm(emptyForm)
    setMessage('')
  }

  function handleBulkReset() {
    setBulkForm(emptyBulkForm)
    setMessage('')
  }

  function handleSeriesPriceReset() {
    setSeriesPriceForm(emptySeriesPriceForm)
    setMessage('')
  }

  function handleFilterReset() {
    setFilters(emptyFilters)
    setSearch('')
  }

  function handleStockInputChange(id, value) {
    setStockInputs((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  async function saveInlineStock(id) {
    const raw = stockInputs[id]
    const nextStock = Number(raw)

    if (raw === undefined || raw === '' || Number.isNaN(nextStock) || nextStock < 0) {
      setMessage('请输入正确库存')
      return
    }

    setStockSavingId(id)
    setMessage('')

    const { error } = await supabase
      .from('products')
      .update({ stock: nextStock })
      .eq('id', id)

    if (error) {
      setMessage(error.message || '更新库存失败')
      setStockSavingId('')
      return
    }

    setMessage('库存已更新')
    setStockInputs((prev) => ({
      ...prev,
      [id]: '',
    }))

    await fetchProducts()
    setStockSavingId('')
  }

  async function quickRestock(id, addQty) {
    const p = products.find((x) => x.id === id)
    if (!p) return

    const newStock = Number(p.stock || 0) + Number(addQty || 0)

    setRestockingId(id)
    setMessage('')

    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', id)

    if (error) {
      setMessage(error.message || '快速补货失败')
    } else {
      setMessage(`已补货 +${addQty}`)
      await fetchProducts()
    }

    setRestockingId('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const productType = form.product_type.trim()
      const brand = form.brand.trim()
      const series = form.series.trim()
      const flavor = form.flavor.trim()

      if (!productType) throw new Error('请选择分类')
      if (!brand) throw new Error('请填写品牌')
      if (!series) throw new Error('请填写系列')
      if (!flavor) throw new Error(`请填写${getVariantLabel(productType)}`)

      const payload = {
        product_type: productType,
        brand,
        series,
        flavor,
        name: form.name.trim() || makeName(flavor),
        sku: form.sku.trim() || makeSku(brand, series, flavor),
        price_1: Number(form.price_1 || 0),
        price_2: Number(form.price_2 || 0),
        price_3: Number(form.price_3 || 0),
        stock: Number(form.stock || 0),
        cost: Number(form.cost || 0),
      }

      let res
      if (editingId) {
        res = await supabase.from('products').update(payload).eq('id', editingId)
      } else {
        res = await supabase.from('products').insert(payload)
      }

      if (res.error) throw res.error

      setMessage(editingId ? '产品已更新' : '产品已新增')
      handleReset()
      fetchProducts()
      setActiveTab('list')
    } catch (error) {
      setMessage(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkSubmit(e) {
    e.preventDefault()
    setBulkSaving(true)
    setMessage('')

    try {
      const productType = bulkForm.product_type.trim()
      const brand = bulkForm.brand.trim()
      const series = bulkForm.series.trim()
      const price1 = Number(bulkForm.price_1 || 0)
      const price2 = Number(bulkForm.price_2 || 0)
      const price3 = Number(bulkForm.price_3 || 0)
      const stock = Number(bulkForm.stock || 0)

      if (!productType) throw new Error('请选择分类')
      if (!brand) throw new Error('请填写品牌')
      if (!series) throw new Error('请填写系列')
      if (!bulkForm.flavorsText.trim()) {
        throw new Error(`请填写${getVariantLabel(productType)}内容`)
      }

      const flavors = bulkForm.flavorsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      if (flavors.length === 0) throw new Error(`没有可新增的${getVariantLabel(productType)}`)

      const rows = flavors.map((flavor) => ({
        cost: Number(bulkForm.cost || 0),
        product_type: productType,
        brand,
        series,
        flavor,
        name: makeName(flavor),
        sku: makeSku(brand, series, flavor),
        price_1: price1,
        price_2: price2,
        price_3: price3,
        stock,
      }))

      const { error } = await supabase.from('products').insert(rows)

      if (error) throw error

      setMessage(`成功新增 ${rows.length} 个产品`)
      handleBulkReset()
      fetchProducts()
      setActiveTab('list')
    } catch (error) {
      setMessage(error.message || '批量新增失败')
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleSeriesPriceSubmit(e) {
    e.preventDefault()
    setSeriesSaving(true)
    setMessage('')

    try {
      const brand = seriesPriceForm.brand.trim()
      const series = seriesPriceForm.series.trim()
      const price1 = Number(seriesPriceForm.price_1)
      const price2 = Number(seriesPriceForm.price_2)
      const price3 = Number(seriesPriceForm.price_3)

      if (!brand) throw new Error('请填写 Brand')
      if (!series) throw new Error('请填写 Series')

      if (
        seriesPriceForm.price_1 === '' ||
        seriesPriceForm.price_2 === '' ||
        seriesPriceForm.price_3 === ''
      ) {
        throw new Error('请填写完整的三级代理价格')
      }

      if (Number.isNaN(price1) || Number.isNaN(price2) || Number.isNaN(price3)) {
        throw new Error('价格格式不正确')
      }

      const { data: matchedProducts, error: checkError } = await supabase
        .from('products')
        .select('id, brand, series')
        .eq('brand', brand)
        .eq('series', series)

      if (checkError) throw checkError

      if (!matchedProducts || matchedProducts.length === 0) {
        throw new Error(`找不到 brand = ${brand} 且 series = ${series} 的产品`)
      }

      const { error } = await supabase
        .from('products')
        .update({
  price_1: price1,
  price_2: price2,
  price_3: price3,
  cost: Number(seriesPriceForm.cost || 0), // 🔥 关键
})
        .eq('brand', brand)
        .eq('series', series)

      if (error) throw error

      setMessage(`品牌 ${brand} / 系列 ${series} 的全部产品价格已更新`)
      handleSeriesPriceReset()
      fetchProducts()
      setActiveTab('list')
    } catch (error) {
      setMessage(error.message || '批量更新价格失败')
    } finally {
      setSeriesSaving(false)
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm('确定删除这个产品？')
    if (!ok) return

    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) {
      setMessage(error.message)
    } else {
      if (editingId === id) {
        handleReset()
      }
      setMessage('产品已删除')
      fetchProducts()
    }
  }

  function renderFilterBar() {
    return (
      <div
        style={{
          background: '#fffaf5',
          border: '1px solid #ead7c4',
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: 12,
            marginBottom: 16,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>快速查找 / 编辑产品</h2>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{
                ...tabButtonStyle,
                ...(activeTab === 'list' ? activeTabButtonStyle : {}),
              }}
              onClick={() => setActiveTab('list')}
            >
              产品列表
            </button>
            <button
              type="button"
              style={{
                ...tabButtonStyle,
                ...(activeTab === 'single' ? activeTabButtonStyle : {}),
              }}
              onClick={() => setActiveTab('single')}
            >
              单个操作
            </button>
            <button
              type="button"
              style={{
                ...tabButtonStyle,
                ...(activeTab === 'bulk' ? activeTabButtonStyle : {}),
              }}
              onClick={() => setActiveTab('bulk')}
            >
              批量操作
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.2fr repeat(4, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <input
            placeholder="搜索 SKU / Name / Brand / Series / 口味"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />

          <select
            value={filters.product_type}
            onChange={(e) => handleFilterChange('product_type', e.target.value)}
            style={inputStyle}
          >
            <option value="">全部分类</option>
            {filterProductTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={filters.brand}
            onChange={(e) => handleFilterChange('brand', e.target.value)}
            style={inputStyle}
          >
            <option value="">全部 Brand</option>
            {filterBrandOptions.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          <select
            value={filters.series}
            onChange={(e) => handleFilterChange('series', e.target.value)}
            style={inputStyle}
          >
            <option value="">全部 Series</option>
            {filterSeriesOptions.map((series) => (
              <option key={series} value={series}>
                {series}
              </option>
            ))}
          </select>

          <select
            value={filters.flavor}
            onChange={(e) => handleFilterChange('flavor', e.target.value)}
            style={inputStyle}
          >
            <option value="">全部{getVariantLabel(filters.product_type || '烟弹')}</option>
            {filterFlavorOptions.map((flavor) => (
              <option key={flavor} value={flavor}>
                {flavor}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" style={secondaryButton} onClick={handleFilterReset}>
            清空筛选
          </button>
          <div style={filterResultStyle}>当前找到 {filteredProducts.length} 个产品</div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, minmax(0, 1fr))',
            gap: 12,
            marginTop: 16,
          }}
        >
          <div style={stockStatCardStyle}>
            <div style={stockStatLabelStyle}>OUT OF STOCK</div>
            <div style={{ ...stockStatValueStyle, color: '#dc2626' }}>{stockStats.out}</div>
          </div>

          <div style={stockStatCardStyle}>
            <div style={stockStatLabelStyle}>VERY LOW</div>
            <div style={{ ...stockStatValueStyle, color: '#dc2626' }}>{stockStats.veryLow}</div>
          </div>

          <div style={stockStatCardStyle}>
            <div style={stockStatLabelStyle}>LOW</div>
            <div style={{ ...stockStatValueStyle, color: '#d97706' }}>{stockStats.low}</div>
          </div>

          <div style={stockStatCardStyle}>
            <div style={stockStatLabelStyle}>IN STOCK</div>
            <div style={{ ...stockStatValueStyle, color: '#0891b2' }}>{stockStats.inStock}</div>
          </div>
        </div>
      </div>
    )
  }

  function renderListPanel() {
    return (
      <div
        style={{
          background: '#fffaf5',
          border: '1px solid #ead7c4',
          borderRadius: 20,
          padding: 20,
          overflowX: 'auto',
        }}
      >
        {loading ? (
          <div>读取中...</div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 260px)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1520 }}>
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  background: '#fffaf5',
                }}
              >
                <tr>
                  {[
  '分类',
  'Brand',
  'Series',
  '口味/颜色',
  'Name',
  'SKU',
  'LV1',
  'LV2',
  'LV3',
  'Cost', // ✅ 新增
  '库存状态',
  '快速补货',
  '手动库存',
  '操作',
].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isEditing = editingId === p.id
                  const status = stockStatus(p.stock)

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleEdit(p)}
                      style={{
                        cursor: 'pointer',
                        background: isEditing ? '#f5e6d7' : '#fffaf5',
                        transition: '0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isEditing) e.currentTarget.style.background = '#fcf3ea'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isEditing ? '#f5e6d7' : '#fffaf5'
                      }}
                    >
                      <td style={tdStyle}>{p.product_type || '-'}</td>
                      <td style={tdStyle}>{p.brand}</td>
                      <td style={tdStyle}>{p.series}</td>
                      <td style={tdStyle}>{p.flavor}</td>
                      <td style={tdStyle}>{p.name}</td>
                      <td style={tdStyle}>{p.sku}</td>
                      <td style={tdStyle}>{p.price_1 ?? 0}</td>
                      <td style={tdStyle}>{p.price_2 ?? 0}</td>
                      <td style={tdStyle}>{p.price_3 ?? 0}</td>
                      <td style={tdStyle}>
  RM {Number(p.cost || 0).toFixed(2)}
</td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontWeight: 800 }}>{p.stock ?? 0}</div>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: 28,
                              padding: '0 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                              color: status.color,
                              background: status.bg,
                              border: `1px solid ${status.border}`,
                              width: 'fit-content',
                            }}
                          >
                            {status.text}
                          </div>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={miniBtn}
                            disabled={restockingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              quickRestock(p.id, 10)
                            }}
                          >
                            +10
                          </button>

                          <button
                            type="button"
                            style={miniBtn}
                            disabled={restockingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              quickRestock(p.id, 50)
                            }}
                          >
                            +50
                          </button>

                          <button
                            type="button"
                            style={miniBtn}
                            disabled={restockingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              quickRestock(p.id, 100)
                            }}
                          >
                            +100
                          </button>

                          {Number(p.stock || 0) <= 0 ? (
                            <button
                              type="button"
                              style={dangerMiniBtn}
                              disabled={restockingId === p.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                quickRestock(p.id, 50)
                              }}
                            >
                              RESTOCK
                            </button>
                          ) : null}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            value={stockInputs[p.id] ?? ''}
                            placeholder="库存"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStockInputChange(p.id, e.target.value)}
                            style={{
                              width: 90,
                              height: 34,
                              borderRadius: 10,
                              border: '1px solid #d7bfa8',
                              background: '#fff',
                              padding: '0 10px',
                              outline: 'none',
                              color: '#6f4e37',
                            }}
                          />

                          <button
                            type="button"
                            style={smallPrimaryButton}
                            disabled={stockSavingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              saveInlineStock(p.id)
                            }}
                          >
                            {stockSavingId === p.id ? '保存中' : '保存'}
                          </button>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={smallPrimaryButton}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(p)
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            style={smallSecondaryButton}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditSeriesPrice(p)
                            }}
                          >
                            整组价格
                          </button>
                          <button
                            type="button"
                            style={smallDangerButton}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(p.id)
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={13} style={tdStyle}>
                      没有找到符合筛选条件的产品
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  function renderSingleForm() {
    return (
      <form
        id="single-form-panel"
        onSubmit={handleSubmit}
        style={{
          background: '#fffaf5',
          border: '1px solid #ead7c4',
          borderRadius: 20,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
          {editingId ? '单个编辑产品' : '单个新增 / 编辑产品'}
        </h2>

        {editingId ? (
          <div style={editingTipStyle}>当前已选中产品，修改后点击【更新产品】即可保存</div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <select
            value={form.product_type}
            onChange={(e) => handleChange('product_type', e.target.value)}
            style={inputStyle}
          >
            {PRODUCT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            placeholder="Brand"
            value={form.brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Series"
            value={form.series}
            onChange={(e) => handleChange('series', e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder={form.product_type === '烟杆' ? '颜色' : '口味'}
            value={form.flavor}
            onChange={(e) => handleChange('flavor', e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Name（可留空，默认只用口味/颜色）"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="SKU（可留空自动生成）"
            value={form.sku}
            onChange={(e) => handleChange('sku', e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="LV1 Price"
            value={form.price_1}
            onChange={(e) => handleChange('price_1', e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="LV2 Price"
            value={form.price_2}
            onChange={(e) => handleChange('price_2', e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="LV3 Price"
            value={form.price_3}
            onChange={(e) => handleChange('price_3', e.target.value)}
            style={inputStyle}
          />
<input
  placeholder="Cost"
  value={seriesPriceForm.cost}
  onChange={(e) => handleSeriesPriceChange('cost', e.target.value)}
  style={inputStyle}
/>
          <input
            placeholder="Stock"
            value={form.stock}
            onChange={(e) => handleChange('stock', e.target.value)}
            style={inputStyle}
          />
          <input
  placeholder="Cost（成本）"
  value={form.cost}
  onChange={(e) => handleChange('cost', e.target.value)}
  style={inputStyle}
/>
        </div>

        <div style={tipBoxStyle}>
          自动生成规则：
          <br />
          Name = {getVariantLabel(form.product_type)}
          <br />
          SKU = 品牌-系列-{getVariantLabel(form.product_type)}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="submit" style={primaryButton} disabled={saving}>
            {saving ? '保存中...' : editingId ? '更新产品' : '新增产品'}
          </button>

          <button type="button" style={secondaryButton} onClick={handleReset}>
            {editingId ? '取消编辑' : '清空'}
          </button>
        </div>
      </form>
    )
  }

  function renderBulkPanel() {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <form
          onSubmit={handleBulkSubmit}
          style={{
            background: '#fffaf5',
            border: '1px solid #ead7c4',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>一键批量新增产品</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <select
              value={bulkForm.product_type}
              onChange={(e) => handleBulkChange('product_type', e.target.value)}
              style={inputStyle}
            >
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              placeholder="品牌，例如 LANA"
              value={bulkForm.brand}
              onChange={(e) => handleBulkChange('brand', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="系列，例如 1代"
              value={bulkForm.series}
              onChange={(e) => handleBulkChange('series', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="LV1 默认价格，例如 14.8"
              value={bulkForm.price_1}
              onChange={(e) => handleBulkChange('price_1', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="LV2 默认价格，例如 15.5"
              value={bulkForm.price_2}
              onChange={(e) => handleBulkChange('price_2', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="LV3 默认价格，例如 16"
              value={bulkForm.price_3}
              onChange={(e) => handleBulkChange('price_3', e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="默认库存，例如 100"
              value={bulkForm.stock}
              onChange={(e) => handleBulkChange('stock', e.target.value)}
              style={inputStyle}
            />
            <input
  placeholder="默认成本，例如 8.5"
  value={bulkForm.cost}
  onChange={(e) => handleBulkChange('cost', e.target.value)}
  style={inputStyle}
/>
          </div>

          <textarea
            placeholder={`每行一个${getVariantLabel(bulkForm.product_type)}，例如：
LUSH ICE
MINERAL WATER
COLA
MANGO
STRAWBERRY`}
            value={bulkForm.flavorsText}
            onChange={(e) => handleBulkChange('flavorsText', e.target.value)}
            style={{
              ...inputStyle,
              height: 220,
              paddingTop: 12,
              resize: 'vertical',
            }}
          />

          <div style={tipBoxStyle}>
            自动生成规则：
            <br />
            Name = {getVariantLabel(bulkForm.product_type)}
            <br />
            SKU = 品牌-系列-{getVariantLabel(bulkForm.product_type)}
            <br />
            LV1 / LV2 / LV3 会套用你上面填写的默认值
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="submit" style={primaryButton} disabled={bulkSaving}>
              {bulkSaving ? '上传中...' : '一键新增到 Supabase'}
            </button>
            <button type="button" style={secondaryButton} onClick={handleBulkReset}>
              清空
            </button>
          </div>
        </form>

        <form
          id="series-price-panel"
          onSubmit={handleSeriesPriceSubmit}
          style={{
            background: '#fffaf5',
            border: '1px solid #ead7c4',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
            按 Brand + Series 一键修改全部价格
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1.2fr 1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <input
              placeholder="Brand，例如 LANA"
              value={seriesPriceForm.brand}
              onChange={(e) => handleSeriesPriceChange('brand', e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Series，例如 1代"
              value={seriesPriceForm.series}
              onChange={(e) => handleSeriesPriceChange('series', e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="LV1"
              value={seriesPriceForm.price_1}
              onChange={(e) => handleSeriesPriceChange('price_1', e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="LV2"
              value={seriesPriceForm.price_2}
              onChange={(e) => handleSeriesPriceChange('price_2', e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="LV3"
              value={seriesPriceForm.price_3}
              onChange={(e) => handleSeriesPriceChange('price_3', e.target.value)}
              style={inputStyle}
            />
            <input
  placeholder="Cost"
  value={seriesPriceForm.cost}
  onChange={(e) => handleSeriesPriceChange('cost', e.target.value)}
  style={inputStyle}
/>
          </div>

          <div style={tipBoxStyle}>
            这个功能会把所有 <b>Brand + Series 完全相同</b> 的产品一起更新成同一套代理价格。
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="submit" style={primaryButton} disabled={seriesSaving}>
              {seriesSaving ? '更新中...' : '一键更新该 Brand + Series 全部价格'}
            </button>
            <button type="button" style={secondaryButton} onClick={handleSeriesPriceReset}>
              清空
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div style={{ minWidth: 0 }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 20 }}>产品管理</h1>

      {renderFilterBar()}

      {message && <div style={messageStyle}>{message}</div>}

      {activeTab === 'list' && renderListPanel()}

      {activeTab === 'single' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.2fr) minmax(320px, 460px)',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <div>{renderListPanel()}</div>
          <div
            style={{
              position: isMobile ? 'static' : 'sticky',
              top: 20,
            }}
          >
            {renderSingleForm()}
          </div>
        </div>
      )}

      {activeTab === 'bulk' && renderBulkPanel()}
    </div>
  )
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
  fontSize: 15,
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

const miniBtn = {
  height: 28,
  padding: '0 8px',
  borderRadius: 8,
  border: '1px solid #d7bfa8',
  background: '#fff',
  color: '#6f4e37',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}

const dangerMiniBtn = {
  height: 28,
  padding: '0 8px',
  borderRadius: 8,
  border: '1px solid #dc2626',
  background: '#dc2626',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}

const thStyle = {
  textAlign: 'left',
  padding: '14px 12px',
  borderBottom: '1px solid #ead7c4',
  whiteSpace: 'nowrap',
  fontWeight: 800,
  color: '#6f4e37',
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #f0e3d6',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}

const messageStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px solid #d8b99d',
}

const tipBoxStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px dashed #d8b99d',
  fontSize: 14,
  lineHeight: 1.8,
}

const editingTipStyle = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  background: '#fff4e8',
  border: '1px solid #dfbf99',
  fontSize: 14,
  lineHeight: 1.6,
}

const filterResultStyle = {
  height: 46,
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px solid #ead7c4',
  fontWeight: 700,
}

const tabButtonStyle = {
  height: 42,
  padding: '0 16px',
  borderRadius: 12,
  border: '1px solid #d7bfa8',
  background: '#fff8f1',
  color: '#6f4e37',
  fontWeight: 800,
  cursor: 'pointer',
}

const activeTabButtonStyle = {
  background: '#a47c57',
  color: '#fff',
  border: '1px solid #a47c57',
}

const stockStatCardStyle = {
  background: '#fff',
  border: '1px solid #ead7c4',
  borderRadius: 16,
  padding: 16,
}

const stockStatLabelStyle = {
  color: '#8a6a54',
  fontWeight: 800,
  marginBottom: 8,
  fontSize: 13,
}

const stockStatValueStyle = {
  fontSize: 24,
  fontWeight: 900,
}