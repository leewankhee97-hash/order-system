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
  is_muar_only: false,
}
 
const emptyBulkForm = {
  product_type: '烟弹',
  brand: '',
  series: '',
  price_1: '',
  price_2: '',
  price_3: '',
  stock: '',
  cost: '',
  is_muar_only: false,
  flavorsText: '',
}
 
const emptySeriesPriceForm = {
  brand: '',
  series: '',
  price_1: '',
  price_2: '',
  price_3: '',
  cost: '',
  is_muar_only: false,
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
  const [productDrafts, setProductDrafts] = useState({})
  const [batchSavingKey, setBatchSavingKey] = useState('')
 
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
 
  const bulkBrandOptions = useMemo(() => {
    return uniqueSorted(products.map((p) => p.brand))
  }, [products])
 
  const bulkSeriesOptions = useMemo(() => {
    return uniqueSorted(
      products
        .filter((p) => !bulkForm.brand || p.brand === bulkForm.brand)
        .map((p) => p.series)
    )
  }, [products, bulkForm.brand])
 
  const seriesPriceBrandOptions = useMemo(() => {
    return uniqueSorted(products.map((p) => p.brand))
  }, [products])
 
 
  const seriesPriceSeriesOptions = useMemo(() => {
    return uniqueSorted(
      products
        .filter((p) => !seriesPriceForm.brand || p.brand === seriesPriceForm.brand)
        .map((p) => p.series)
    )
  }, [products, seriesPriceForm.brand])
 
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
          String(p.cost ?? ''),
          String(p.stock ?? ''),
          stockStatus(p.stock).text,
          p.is_muar_only ? 'muar muar出货 不可混单' : '',
        
        ]
          .join(' ')
          .toLowerCase()
 
        if (!target.includes(keyword)) return false
      }
 
      return true
    })
  }, [products, filters, search])
 
  const visibleDraftCount = useMemo(() => {
    return filteredProducts.filter((p) => hasProductPendingChanges(p.id)).length
  }, [filteredProducts, productDrafts])
 
  const visibleSaveLabel = useMemo(() => {
    if (filters.brand && filters.series) return `${filters.brand} / ${filters.series}`
    if (filters.brand) return filters.brand
    return '当前筛选产品'
  }, [filters.brand, filters.series])
 
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
      is_muar_only: Boolean(product.is_muar_only),
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
      cost: product.cost ?? '',
      is_muar_only: Boolean(product.is_muar_only),
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
 
  function handleProductDraftChange(id, key, value) {
    setProductDrafts((prev) => {
      const current = prev[id] || {}
 
      return {
        ...prev,
        [id]: {
          ...current,
          [key]: value,
        },
      }
    })
  }
 
  function handleStockInputChange(id, value) {
    handleProductDraftChange(id, 'stock', value)
  }
 
  function getProductDraftValue(product, key) {
    const draft = productDrafts[product.id] || {}
 
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
      return draft[key]
    }
 
    if (key === 'is_muar_only') return Boolean(product?.is_muar_only)
    return product?.[key] ?? ''
  }
 
  function hasProductPendingChanges(productId) {
    const draft = productDrafts[productId]
    return Boolean(draft && Object.keys(draft).length > 0)
  }
 
  function buildProductDraftPayload(product) {
    const draft = productDrafts[product.id] || {}
    const payload = {}
 
    const numberFields = [
      ['price_1', 'LV1'],
      ['price_2', 'LV2'],
      ['price_3', 'LV3'],
      ['cost', 'Cost'],
      ['stock', 'Stock'],
    ]
 
    numberFields.forEach(([key, label]) => {
      if (!Object.prototype.hasOwnProperty.call(draft, key)) return
 
      const raw = draft[key]
      const text = String(raw ?? '').trim()
 
      if (text === '') {
        throw new Error(`${product.name || product.flavor || '产品'} 的 ${label} 不能为空`)
      }
 
      const value = Number(text)
 
      if (Number.isNaN(value) || value < 0) {
        throw new Error(`${product.name || product.flavor || '产品'} 的 ${label} 格式不正确`)
      }
 
      payload[key] = value
    })
 
    if (Object.prototype.hasOwnProperty.call(draft, 'is_muar_only')) {
      payload.is_muar_only = Boolean(draft.is_muar_only)
    }
 
    if (Object.keys(payload).length === 0) {
      throw new Error(`${product.name || product.flavor || '产品'} 没有任何可保存的更改`)
    }
 
    return payload
  }
 
  function clearProductDrafts(productIds = []) {
    setProductDrafts((prev) => {
      const next = { ...prev }
 
      productIds.forEach((id) => {
        delete next[id]
      })
 
      return next
    })
  }
 
  async function saveProductDrafts(items = [], label = '当前产品', saveKey = '', askConfirm = true) {
    const changedItems = (items || []).filter((p) => hasProductPendingChanges(p.id))
 
    if (changedItems.length === 0) {
      setMessage('没有检测到需要保存的修改')
      return
    }
 
    if (askConfirm) {
      const ok = window.confirm(`确定保存【${label}】的 ${changedItems.length} 个产品修改？`)
      if (!ok) return
    }
 
    setBatchSavingKey(saveKey || label)
    setMessage('')
 
    try {
      for (const p of changedItems) {
        const payload = buildProductDraftPayload(p)
 
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', p.id)
 
        if (error) {
          throw new Error(`${p.name || p.flavor || p.id} 保存失败：${error.message}`)
        }
      }
 
      clearProductDrafts(changedItems.map((p) => p.id))
      setMessage(`修改成功：已保存 ${changedItems.length} 个产品`)
      await fetchProducts()
    } catch (error) {
      setMessage(error.message || '批量保存失败')
    } finally {
      setBatchSavingKey('')
    }
  }
 
  async function saveInlineStock(id) {
    const product = products.find((x) => x.id === id)
 
    if (!product) return
 
    const draft = productDrafts[id] || {}
 
    if (!Object.prototype.hasOwnProperty.call(draft, 'stock')) {
      setMessage('请输入要修改的库存')
      return
    }
 
    setStockSavingId(id)
    await saveProductDrafts([product], product.name || product.flavor || '产品', `stock-${id}`, false)
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
      clearProductDrafts([id])
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
        is_muar_only: Boolean(form.is_muar_only),
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
      if (String(error?.message || '').includes('products_sku_key')) {
        setMessage('保存失败：SKU 已存在，请更换 SKU 或检查是否已经有同样产品')
      } else {
        setMessage(error.message || '保存失败')
      }
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
      const cost = Number(bulkForm.cost || 0)
 
      if (!productType) throw new Error('请选择分类')
      if (!brand) throw new Error('请输入 Brand')
if (!series) throw new Error('请输入 Series')
      if (!bulkForm.flavorsText.trim()) {
        throw new Error(`请填写${getVariantLabel(productType)}内容`)
      }
 
      const flavors = bulkForm.flavorsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
 
      if (flavors.length === 0) throw new Error(`没有可新增的${getVariantLabel(productType)}`)
 
      const rows = flavors.map((flavor) => ({
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
        cost,
        is_muar_only: Boolean(bulkForm.is_muar_only),
      }))
 
      const seenSku = new Set()
      const uniqueRows = []
      rows.forEach((row) => {
        if (seenSku.has(row.sku)) {
          return
        }
 
        seenSku.add(row.sku)
        uniqueRows.push(row)
      })
 
      const { data: existingRows, error: skuCheckError } = await supabase
        .from('products')
        .select('sku')
        .in('sku', uniqueRows.map((row) => row.sku))
 
      if (skuCheckError) throw skuCheckError
 
      const existingSkuSet = new Set((existingRows || []).map((row) => row.sku))
      const rowsToInsert = uniqueRows.filter((row) => !existingSkuSet.has(row.sku))
      const skipped = rows.length - rowsToInsert.length
 
      if (rowsToInsert.length === 0) {
        throw new Error('没有新增产品：这些 SKU 已存在或输入内容重复')
      }
 
      const { error } = await supabase.from('products').insert(rowsToInsert)
 
      if (error) throw error
 
      setMessage(`成功新增 ${rowsToInsert.length} 个产品${skipped > 0 ? `，跳过 ${skipped} 个重复 SKU` : ''}`)
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
      const cost = Number(seriesPriceForm.cost || 0)
 
      if (!brand) throw new Error('请选择 Brand')
      if (!series) throw new Error('请选择 Series')
 
      // 允许只更新 MUAR 状态，不强制一定要填写价格或成本
 
      if (Number.isNaN(price1) || Number.isNaN(price2) || Number.isNaN(price3)) {
        throw new Error('价格格式不正确')
      }
 
      if (seriesPriceForm.cost !== '' && Number.isNaN(cost)) {
        throw new Error('成本格式不正确')
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
 
      const payload = {}
      payload.is_muar_only = Boolean(seriesPriceForm.is_muar_only)
 
if (seriesPriceForm.price_1 !== '') payload.price_1 = price1
if (seriesPriceForm.price_2 !== '') payload.price_2 = price2
if (seriesPriceForm.price_3 !== '') payload.price_3 = price3
if (seriesPriceForm.cost !== '') payload.cost = cost
 
      if (seriesPriceForm.cost !== '') {
        payload.cost = cost
      }
 
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('brand', brand)
        .eq('series', series)
 
      if (error) throw error
 
      setMessage('修改成功')
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
 
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={secondaryButton} onClick={handleFilterReset}>
            清空筛选
          </button>
 
          <button
            type="button"
            style={{
              ...primaryButton,
              opacity: visibleDraftCount === 0 || batchSavingKey === 'visible-list' ? 0.55 : 1,
              cursor: visibleDraftCount === 0 || batchSavingKey === 'visible-list' ? 'not-allowed' : 'pointer',
            }}
            disabled={visibleDraftCount === 0 || batchSavingKey === 'visible-list'}
            onClick={() => saveProductDrafts(filteredProducts, visibleSaveLabel, 'visible-list')}
          >
            {batchSavingKey === 'visible-list' ? '保存中...' : `保存当前系列 / 筛选修改（${visibleDraftCount}）`}
          </button>
 
          <button
            type="button"
            style={secondaryButton}
            disabled={visibleDraftCount === 0}
            onClick={() => clearProductDrafts(filteredProducts.map((p) => p.id))}
          >
            清除未保存修改
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
    const compactTdStyle = {
      ...tdStyle,
      padding: '9px 10px',
      whiteSpace: 'normal',
      lineHeight: 1.35,
      verticalAlign: 'middle',
    }
 
    const compactInputStyle = {
      ...inlineInputStyle,
      width: isMobile ? 72 : 78,
      height: 34,
    }
 
    return (
      <div
        style={{
          background: '#fffaf5',
          border: '1px solid #ead7c4',
          borderRadius: 20,
          padding: isMobile ? 12 : 16,
          overflowX: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#6f4e37' }}>
              产品列表 / 快速编辑
            </div>
            <div style={{ fontSize: 13, color: '#8a6a54', marginTop: 4 }}>
              直接修改 LV1 / LV2 / LV3 / Cost / Stock / MUAR，然后按上方【保存当前系列 / 筛选修改】一次保存。
            </div>
          </div>
 
          <button
            type="button"
            style={secondaryButton}
            onClick={() => {
              handleReset()
              setActiveTab('single')
            }}
          >
            + 新增产品
          </button>
        </div>
 
        {loading ? (
          <div>读取中...</div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 980 : 1120 }}>
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
                    'LV1',
                    'LV2',
                    'LV3',
                    'Cost',
                    'Stock',
                    'MUAR',
                    '状态',
                    '操作',
                  ].map((h) => (
                    <th key={h} style={{ ...thStyle, padding: '12px 10px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
 
              <tbody>
                {filteredProducts.map((p) => {
                  const isEditing = editingId === p.id
                  const draftChanged = hasProductPendingChanges(p.id)
                  const displayStock = getProductDraftValue(p, 'stock')
                  const status = stockStatus(displayStock)
                  const normalRowBg = draftChanged ? '#fff7e6' : '#fffaf5'
 
                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: isEditing ? '#f5e6d7' : normalRowBg,
                        transition: '0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isEditing) e.currentTarget.style.background = '#fcf3ea'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isEditing ? '#f5e6d7' : normalRowBg
                      }}
                    >
                      <td style={compactTdStyle}>{p.product_type || '-'}</td>
                      <td style={compactTdStyle}>{p.brand || '-'}</td>
                      <td style={compactTdStyle}>{p.series || '-'}</td>
                      <td style={{ ...compactTdStyle, minWidth: 180, fontWeight: 800 }}>
                        {p.flavor || p.name || '-'}
                      </td>
 
                      <td style={compactTdStyle}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getProductDraftValue(p, 'price_1')}
                          onChange={(e) => handleProductDraftChange(p.id, 'price_1', e.target.value)}
                          style={compactInputStyle}
                        />
                      </td>
 
                      <td style={compactTdStyle}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getProductDraftValue(p, 'price_2')}
                          onChange={(e) => handleProductDraftChange(p.id, 'price_2', e.target.value)}
                          style={compactInputStyle}
                        />
                      </td>
 
                      <td style={compactTdStyle}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getProductDraftValue(p, 'price_3')}
                          onChange={(e) => handleProductDraftChange(p.id, 'price_3', e.target.value)}
                          style={compactInputStyle}
                        />
                      </td>
 
                      <td style={compactTdStyle}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getProductDraftValue(p, 'cost')}
                          onChange={(e) => handleProductDraftChange(p.id, 'cost', e.target.value)}
                          style={compactInputStyle}
                        />
                      </td>
 
                      <td style={compactTdStyle}>
                        <input
                          type="number"
                          min="0"
                          value={getProductDraftValue(p, 'stock')}
                          onChange={(e) => handleProductDraftChange(p.id, 'stock', e.target.value)}
                          style={compactInputStyle}
                        />
                      </td>
 
                      <td style={compactTdStyle}>
                        <label style={inlineCheckboxStyle}>
                          <input
                            type="checkbox"
                            checked={Boolean(getProductDraftValue(p, 'is_muar_only'))}
                            onChange={(e) => handleProductDraftChange(p.id, 'is_muar_only', e.target.checked)}
                          />
                          <span>{Boolean(getProductDraftValue(p, 'is_muar_only')) ? 'MUAR' : '普通'}</span>
                        </label>
                      </td>
 
                      <td style={compactTdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontWeight: 900 }}>{displayStock || 0}</div>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: 26,
                              padding: '0 9px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 900,
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
 
                      <td style={{ ...compactTdStyle, minWidth: 220 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {draftChanged ? <span style={draftBadgeStyle}>未保存</span> : null}
 
                          <button
                            type="button"
                            style={{
                              ...smallPrimaryButton,
                              opacity: draftChanged && batchSavingKey !== `row-${p.id}` ? 1 : 0.55,
                              cursor: draftChanged ? 'pointer' : 'not-allowed',
                            }}
                            disabled={!draftChanged || batchSavingKey === `row-${p.id}`}
                            onClick={() => saveProductDrafts([p], p.name || p.flavor || '产品', `row-${p.id}`, false)}
                          >
                            {batchSavingKey === `row-${p.id}` ? '保存中' : '保存本行'}
                          </button>
 
                          <button type="button" style={smallSecondaryButton} onClick={() => handleEdit(p)}>
                            编辑
                          </button>
 
                          <button type="button" style={smallSecondaryButton} onClick={() => handleEditSeriesPrice(p)}>
                            整组
                          </button>
 
                          <button type="button" style={smallDangerButton} onClick={() => handleDelete(p.id)}>
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
 
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={12} style={compactTdStyle}>
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
 
          <label style={checkboxBoxStyle}>
            <input
              type="checkbox"
              checked={Boolean(form.is_muar_only)}
              onChange={(e) => handleChange('is_muar_only', e.target.checked)}
            />
            <span>MUAR 出货（不可混单）</span>
          </label>
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
 
          <button type="button" style={secondaryButton} onClick={() => setActiveTab('list')}>
            返回产品列表
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
  placeholder="输入 Brand，例如 SP2"
  value={bulkForm.brand}
  onChange={(e) => handleBulkChange('brand', e.target.value)}
  style={inputStyle}
/>
 
<input
  placeholder="输入 Series，例如 CRYSTAL PLUS"
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
 
            <label style={checkboxBoxStyle}>
              <input
                type="checkbox"
                checked={Boolean(bulkForm.is_muar_only)}
                onChange={(e) => handleBulkChange('is_muar_only', e.target.checked)}
              />
              <span>MUAR 出货（不可混单）</span>
            </label>
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
            LV1 / LV2 / LV3 / Cost 会套用你上面填写的默认值
            <br />
            如果勾选 MUAR 出货，整批新增都会标记为不可混单
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
            按 Brand + Series 一键修改全部价格 / 成本
          </h2>
 
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1.2fr 1fr 1fr 1fr 1fr',
 
              gap: 12,
            }}
          >
            <select
              value={seriesPriceForm.brand}
              onChange={(e) => {
                handleSeriesPriceChange('brand', e.target.value)
                handleSeriesPriceChange('series', '')
              }}
              style={inputStyle}
            >
              <option value="">选择 Brand</option>
              {seriesPriceBrandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
 
            <select
              value={seriesPriceForm.series}
              onChange={(e) => handleSeriesPriceChange('series', e.target.value)}
              style={inputStyle}
            >
              <option value="">选择 Series</option>
              {seriesPriceSeriesOptions.map((series) => (
                <option key={series} value={series}>
                  {series}
                </option>
              ))}
            </select>
 
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
 
<label style={{ ...checkboxBoxStyle, marginTop: 12 }}>
  <input
    type="checkbox"
    checked={Boolean(seriesPriceForm.is_muar_only)}
    onChange={(e) =>
      handleSeriesPriceChange('is_muar_only', e.target.checked)
    }
  />
  <span>MUAR 出货（不可混单）</span>
</label>
          </div>
 
          <div style={tipBoxStyle}>
            这个功能会把所有 <b>Brand + Series 完全相同</b> 的产品一起更新成同一套代理价格。
            <br />
            如果 Cost 有填写，也会一起更新整组成本；如果 Cost 留空，则不会改成本。
            <br />
            勾选 MUAR 出货会把整组标记为不可混单；不勾选则会把整组取消 MUAR 标记。
          </div>
 
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="submit" style={primaryButton} disabled={seriesSaving}>
              {seriesSaving ? '更新中...' : '一键更新该 Brand + Series 全部价格 / 成本'}
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
        <div style={{ maxWidth: 980 }}>
          {renderSingleForm()}
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
 
 
const checkboxBoxStyle = {
  minHeight: 46,
  borderRadius: 14,
  border: '1px solid #d7bfa8',
  background: '#fff8f1',
  padding: '0 12px',
  color: '#6f4e37',
  fontSize: 15,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 800,
}
 
const inlineInputStyle = {
  width: 92,
  height: 34,
  borderRadius: 10,
  border: '1px solid #d7bfa8',
  background: '#fff',
  padding: '0 10px',
  outline: 'none',
  color: '#6f4e37',
  fontWeight: 700,
}
 
const inlineCheckboxStyle = {
  minHeight: 34,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid #d7bfa8',
  background: '#fff8f1',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#6f4e37',
  fontWeight: 800,
  cursor: 'pointer',
}
 
const draftBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  color: '#b45309',
  background: '#fffbeb',
  border: '1px solid #fcd34d',
  whiteSpace: 'nowrap',
}
 
const muarBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  color: '#b91c1c',
  background: '#fff1f2',
  border: '1px solid #fecdd3',
  whiteSpace: 'nowrap',
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
 
