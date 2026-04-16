'use client'

import { useEffect, useState } from 'react'
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
}

const emptySeriesPriceForm = {
  brand: '',
  series: '',
  price_1: '',
  price_2: '',
  price_3: '',
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

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [bulkForm, setBulkForm] = useState(emptyBulkForm)
  const [seriesPriceForm, setSeriesPriceForm] = useState(emptySeriesPriceForm)
  const [editingId, setEditingId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [seriesSaving, setSeriesSaving] = useState(false)

  useEffect(() => {
    fetchProducts()
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
    })
    setMessage('')
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
        price: Number(form.price_1 || 0),
        stock: Number(form.stock || 0),
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
        product_type: productType,
        brand,
        series,
        flavor,
        name: makeName(flavor),
        sku: makeSku(brand, series, flavor),
        price_1: price1,
        price_2: price2,
        price_3: price3,
        price: price1,
        stock,
      }))

      const { error } = await supabase.from('products').insert(rows)

      if (error) throw error

      setMessage(`成功新增 ${rows.length} 个产品`)
      handleBulkReset()
      fetchProducts()
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
          price: price1,
        })
        .eq('brand', brand)
        .eq('series', series)

      if (error) throw error

      setMessage(`品牌 ${brand} / 系列 ${series} 的全部产品价格已更新`)
      handleSeriesPriceReset()
      fetchProducts()
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
      setMessage('产品已删除')
      fetchProducts()
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7efe7',
        padding: 24,
        color: '#6f4e37',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 20 }}>产品管理</h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            marginBottom: 20,
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              background: '#fffaf5',
              border: '1px solid #ead7c4',
              borderRadius: 20,
              padding: 20,
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
              单个新增 / 编辑产品
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
            </div>

            <div style={tipBoxStyle}>
              自动生成规则：
              <br />
              Name = {getVariantLabel(form.product_type)}
              <br />
              SKU = 品牌-系列-{getVariantLabel(form.product_type)}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="submit" style={primaryButton} disabled={saving}>
                {saving ? '保存中...' : editingId ? '更新产品' : '新增产品'}
              </button>
              <button type="button" style={secondaryButton} onClick={handleReset}>
                清空
              </button>
            </div>
          </form>

          <form
            onSubmit={handleBulkSubmit}
            style={{
              background: '#fffaf5',
              border: '1px solid #ead7c4',
              borderRadius: 20,
              padding: 20,
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
              一键批量新增产品
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="submit" style={primaryButton} disabled={bulkSaving}>
                {bulkSaving ? '上传中...' : '一键新增到 Supabase'}
              </button>
              <button type="button" style={secondaryButton} onClick={handleBulkReset}>
                清空
              </button>
            </div>
          </form>
        </div>

        <form
          onSubmit={handleSeriesPriceSubmit}
          style={{
            background: '#fffaf5',
            border: '1px solid #ead7c4',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
            按 Brand + Series 一键修改全部价格
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1fr',
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
          </div>

          <div style={tipBoxStyle}>
            这个功能会把所有 <b>Brand + Series 完全相同</b> 的产品一起更新成同一套代理价格。
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" style={primaryButton} disabled={seriesSaving}>
              {seriesSaving ? '更新中...' : '一键更新该 Brand + Series 全部价格'}
            </button>
            <button type="button" style={secondaryButton} onClick={handleSeriesPriceReset}>
              清空
            </button>
          </div>
        </form>

        {message && <div style={messageStyle}>{message}</div>}

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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1650 }}>
              <thead>
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
                    'Stock',
                    '操作',
                  ].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{p.product_type || '-'}</td>
                    <td style={tdStyle}>{p.brand}</td>
                    <td style={tdStyle}>{p.series}</td>
                    <td style={tdStyle}>{p.flavor}</td>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={tdStyle}>{p.sku}</td>
                    <td style={tdStyle}>{p.price_1 ?? 0}</td>
                    <td style={tdStyle}>{p.price_2 ?? 0}</td>
                    <td style={tdStyle}>{p.price_3 ?? 0}</td>
                    <td style={tdStyle}>{p.stock ?? 0}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={smallPrimaryButton} onClick={() => handleEdit(p)}>
                          编辑
                        </button>
                        <button type="button" style={smallDangerButton} onClick={() => handleDelete(p.id)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {products.length === 0 && (
                  <tr>
                    <td colSpan={11} style={tdStyle}>还没有产品资料</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
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

const tipBoxStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  background: '#f8f0e8',
  border: '1px dashed #d8b99d',
  fontSize: 14,
  lineHeight: 1.8,
}