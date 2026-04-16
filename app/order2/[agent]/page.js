'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const STATES = ['Selangor', 'Johor', 'Penang', 'Perak', 'Sabah', 'Sarawak']
const EAST = ['SABAH', 'SARAWAK']

function money(v) {
  return Number(v || 0).toFixed(2)
}

function stockLabel(stock) {
  const s = Number(stock || 0)
  if (s <= 0) {
    return {
      text: 'OUT OF STOCK',
      cls: 'text-red-500',
      badge: 'border-red-200 bg-red-50 text-red-500',
    }
  }
  if (s <= 50) {
    return {
      text: 'LOW STOCK',
      cls: 'text-amber-500',
      badge: 'border-amber-200 bg-amber-50 text-amber-600',
    }
  }
  return {
    text: 'IN STOCK',
    cls: 'text-cyan-600',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  }
}

function cardGlow(stock) {
  const s = Number(stock || 0)
  if (s <= 0) return 'hover:border-red-200'
  if (s <= 50) return 'hover:border-amber-200'
  return 'hover:border-[#d8c2aa]'
}

function PawPrint({ className = '' }) {
  return (
    <span className={`inline-block ${className}`} aria-hidden="true">
      🐾
    </span>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-[#cba98a] bg-[#dcc0a8] text-white shadow-sm'
          : 'border-[#eadacb] bg-[#fffaf6] text-[#7a5b47] hover:bg-[#f8efe6]'
      }`}
    >
      {children}
    </button>
  )
}

function normalizeText(v) {
  return String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function getProductType(product) {
  const raw = normalizeText(
    product?.product_type ??
      product?.type ??
      product?.category ??
      product?.main_category ??
      ''
  )

  if (
    raw.includes('烟弹') ||
    raw.includes('POD') ||
    raw.includes('弹')
  ) {
    return '烟弹'
  }

  if (
    raw.includes('烟杆') ||
    raw.includes('杆') ||
    raw.includes('DEVICE') ||
    raw.includes('KIT')
  ) {
    return '烟杆'
  }

  if (
    raw.includes('一次性') ||
    raw.includes('抛弃式') ||
    raw.includes('DISPOSABLE') ||
    raw.includes('DISPO')
  ) {
    return '一次性'
  }

  if (!raw) return '未分类'
  return raw
}

function cleanProductName(product) {
  let n = normalizeText(product?.name)

  const brand = normalizeText(product?.brand)
  const series = normalizeText(product?.series)

  if (brand) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    n = n.replace(new RegExp(escaped, 'ig'), ' ')
  }

  if (series) {
    const escaped = series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    n = n.replace(new RegExp(escaped, 'ig'), ' ')
  }

  n = n
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return n || normalizeText(product?.name) || '-'
}

function getVariantLabel(product) {
  const type = getProductType(product)
  if (type === '烟杆') return '颜色'
  return '口味'
}

export default function Page() {
  const { agent } = useParams()

  const [products, setProducts] = useState([])
  const [bundles, setBundles] = useState([])
  const [bundleMap, setBundleMap] = useState({})

  const [cart, setCart] = useState([])
  const [bundleSelect, setBundleSelect] = useState({})
  const [selectedBundle, setSelectedBundle] = useState(null)

  const [agentInfo, setAgentInfo] = useState(null)

  const [delivery, setDelivery] = useState('自取')
  const [orderId, setOrderId] = useState('')

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [state, setState] = useState('')
  const [postcode, setPostcode] = useState('')
  const [shipping, setShipping] = useState('')

  const [selectedType, setSelectedType] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('')
  const [search, setSearch] = useState('')
  const [bundleSearch, setBundleSearch] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedPreview, setCopiedPreview] = useState('')

  const [previewCopied, setPreviewCopied] = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: a } = await supabase
      .from('agents')
      .select('*')
      .or(`agent_slug.eq.${agent},slug.eq.${agent}`)
      .single()

    setAgentInfo(a || null)

    const { data: p } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('brand', { ascending: true })
      .order('series', { ascending: true })
      .order('name', { ascending: true })

    setProducts(p || [])

    const { data: b } = await supabase
      .from('bundle_rules')
      .select('*')
      .eq('is_active', true)

    setBundles(b || [])

    const { data: map } = await supabase
      .from('bundle_rule_products')
      .select('*')

    const obj = {}
    map?.forEach((x) => {
      if (!obj[x.bundle_rule_id]) obj[x.bundle_rule_id] = []
      obj[x.bundle_rule_id].push(x.product_id)
    })
    setBundleMap(obj)
  }

  useEffect(() => {
    if (!agentInfo) return
    const prefix = agentInfo.code || agentInfo.agent_name
    const count = agentInfo.order_counter || 1
    setOrderId(`${prefix}-${String(count).padStart(4, '0')}`)
    setCart([])
  }, [agentInfo])

  function getAgentLevel() {
    const raw = String(agentInfo?.level ?? '1').trim()
    if (raw === '3') return 3
    if (raw === '2') return 2
    return 1
  }

  function getAgentPrice(product) {
    const level = getAgentLevel()

    const p1 = Number(
      product.price_1 ??
        product.price1 ??
        product.price_level_1 ??
        product.retail_price ??
        0
    )

    const p2 = Number(
      product.price_2 ??
        product.price2 ??
        product.price_level_2 ??
        product.agent_price ??
        0
    )

    const p3 = Number(
      product.price_3 ??
        product.price3 ??
        product.price_level_3 ??
        product.vip_price ??
        0
    )

    if (level === 3) return p3
    if (level === 2) return p2
    return p1
  }

  function add(p) {
    const lockedPrice = getAgentPrice(p)

    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id)
      if (found) {
        const nextQty = found.qty + 1
        if (nextQty > Number(p.stock || 0)) return prev
        return prev.map((i) =>
          i.id === p.id ? { ...i, qty: nextQty } : i
        )
      }
      return [...prev, { ...p, qty: 1, price: lockedPrice }]
    })
  }

  function changeCartQty(id, nextQty) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i
          let qty = Number(nextQty || 0)
          if (qty < 0) qty = 0
          if (qty > Number(i.stock || 0)) qty = Number(i.stock || 0)
          return { ...i, qty }
        })
        .filter((i) => i.qty > 0)
    )
  }

  function removeCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id))
  }

  const typeOptions = useMemo(() => {
    const preferredOrder = ['烟弹', '烟杆', '一次性']
    const all = [...new Set(products.map((p) => getProductType(p)).filter(Boolean))]
    const ordered = preferredOrder.filter((x) => all.includes(x))
    const rest = all.filter((x) => !preferredOrder.includes(x)).sort()
    return [...ordered, ...rest]
  }, [products])

  const brandOptions = useMemo(() => {
    if (!selectedType) return []
    return [
      ...new Set(
        products
          .filter((p) => getProductType(p) === selectedType)
          .map((p) => p.brand)
          .filter(Boolean)
      ),
    ]
  }, [products, selectedType])

  const variantOptions = useMemo(() => {
    if (!selectedType || !selectedBrand) return []
    return [
      ...new Set(
        products
          .filter(
            (p) =>
              getProductType(p) === selectedType &&
              p.brand === selectedBrand
          )
          .map((p) => cleanProductName(p))
          .filter(Boolean)
      ),
    ]
  }, [products, selectedType, selectedBrand])

  const currentVariantLabel = useMemo(() => {
    if (!selectedType) return '口味 / 颜色'
    if (selectedType === '烟杆') return '颜色'
    return '口味'
  }, [selectedType])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!selectedType) return []
    if (!selectedBrand) return []
    if (!selectedVariant) return []

    return products.filter((p) => {
      const displayName = cleanProductName(p)
      const joined = [
        getProductType(p),
        p.brand,
        p.series,
        p.name,
        displayName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (getProductType(p) !== selectedType) return false
      if (p.brand !== selectedBrand) return false
      if (displayName !== selectedVariant) return false
      if (q && !joined.includes(q)) return false

      return true
    })
  }, [products, selectedType, selectedBrand, selectedVariant, search])

  const bundleProducts = useMemo(() => {
    if (!selectedBundle) return []
    const ids = bundleMap[selectedBundle.id] || []

    if (ids.length > 0) {
      return products.filter((p) => ids.includes(p.id))
    }

    return products.filter((p) => {
      return p.brand === selectedBundle.brand && p.series === selectedBundle.series
    })
  }, [selectedBundle, products, bundleMap])

  const bundleLimit = Number(selectedBundle?.min_select_qty || 0)

  const bundleCount = useMemo(() => {
    return Object.values(bundleSelect).reduce((s, v) => s + Number(v || 0), 0)
  }, [bundleSelect])

  const bundleRemaining = useMemo(() => {
    const remain = bundleLimit - bundleCount
    return remain > 0 ? remain : 0
  }, [bundleLimit, bundleCount])

  function setBundleQty(pid, qty) {
    const currentMap = { ...bundleSelect }
    const next = Math.max(0, Number(qty || 0))

    currentMap[pid] = next
    const totalAfter = Object.values(currentMap).reduce((s, v) => s + Number(v || 0), 0)

    if (selectedBundle && totalAfter > bundleLimit) return

    setBundleSelect(currentMap)
  }

  function changeBundleQty(pid, delta, maxStock) {
    const current = Number(bundleSelect[pid] || 0)
    let next = current + delta
    if (next < 0) next = 0
    if (next > Number(maxStock || 0)) next = Number(maxStock || 0)
    setBundleQty(pid, next)
  }

  const sortedBundleProducts = useMemo(() => {
    const q = bundleSearch.trim().toLowerCase()

    const list = bundleProducts
      .filter((p) => {
        if (!q) return true
        const joined = [
          p.brand,
          p.series,
          p.name,
          cleanProductName(p),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return joined.includes(q)
      })
      .map((p) => ({
        ...p,
        __displayName: cleanProductName(p),
        __selectedQty: Number(bundleSelect[p.id] || 0),
      }))
      .sort((a, b) => {
        const aSelected = a.__selectedQty > 0 ? 1 : 0
        const bSelected = b.__selectedQty > 0 ? 1 : 0

        if (aSelected !== bSelected) return bSelected - aSelected
        if (b.__selectedQty !== a.__selectedQty) return b.__selectedQty - a.__selectedQty

        return String(a.__displayName).localeCompare(String(b.__displayName))
      })

    return list
  }, [bundleProducts, bundleSearch, bundleSelect])

  const selectedBundleItems = useMemo(() => {
    return sortedBundleProducts.filter((p) => Number(bundleSelect[p.id] || 0) > 0)
  }, [sortedBundleProducts, bundleSelect])

  const cartQty = useMemo(() => {
    return cart.reduce((s, i) => s + Number(i.qty || 0), 0)
  }, [cart])

  const region = useMemo(() => {
    if (!state) return '-'
    return EAST.includes((state || '').toUpperCase()) ? 'East Malaysia' : 'West Malaysia'
  }, [state])

  const normalTotal = useMemo(() => {
    return cart.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0)
  }, [cart])

  const bundleTotal = useMemo(() => {
    return selectedBundle ? Number(selectedBundle.bundle_price || 0) : 0
  }, [selectedBundle])

  const postageItemCount = useMemo(() => {
    const normalQty = cart.reduce((s, i) => s + Number(i.qty || 0), 0)
    const bundleQty = selectedBundle
      ? Object.values(bundleSelect).reduce((s, v) => s + Number(v || 0), 0)
      : 0
    return normalQty + bundleQty
  }, [cart, selectedBundle, bundleSelect])

  const shippingFee = useMemo(() => {
    if (delivery === '邮寄') {
      if (postageItemCount > 19) return 'ASK'
      if (EAST.includes((state || '').toUpperCase())) return 15
      return 10
    }

    return Number(shipping || 0)
  }, [delivery, postageItemCount, state, shipping])

  const total = useMemo(() => {
    if (shippingFee === 'ASK') return normalTotal + bundleTotal
    return normalTotal + bundleTotal + Number(shippingFee || 0)
  }, [normalTotal, bundleTotal, shippingFee])

  const inStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock || 0) > 50).length
  }, [products])

  const lowStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 50).length
  }, [products])

  const outStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock || 0) <= 0).length
  }, [products])

  function resetFormAfterSubmit() {
    setCart([])
    setSelectedBundle(null)
    setBundleSelect({})
    setBundleSearch('')
    setDate('')
    setTime('')
    setName('')
    setPhone('')
    setAddress('')
    setState('')
    setPostcode('')
    setShipping('')
  }

  function shippingText() {
    if (shippingFee === 'ASK') return '请问我查询运费'
    return `RM ${money(shippingFee)}`
  }

  function buildCopiedSummary(oid) {
    const itemLines = []

    cart.forEach((item) => {
      const price = Number(item.price || 0)
      const subtotal = Number(item.qty || 0) * price
      const displayName = cleanProductName(item)

      itemLines.push(`${item.brand || displayName}${item.series ? ` ${item.series}` : ''}（RM${money(price)}）`)
      itemLines.push(`${displayName} - ${item.qty}`)
      itemLines.push(`【TOTAL ${item.qty}*RM${money(price)}=RM${money(subtotal)}】`)
      itemLines.push('')
    })

    if (selectedBundle) {
      itemLines.push(`${selectedBundle.name}（BUNDLE）`)
      Object.entries(bundleSelect).forEach(([pid, qty]) => {
        const p = products.find((x) => String(x.id) === String(pid))
        if (!p || !qty) return
        itemLines.push(`${cleanProductName(p)} - ${qty}`)
      })
      itemLines.push(`【BUNDLE TOTAL = RM${money(bundleTotal)}】`)
      itemLines.push('')
    }

    if (delivery === '邮寄') {
      return [
        `配送方式：邮寄`,
        `地区：${region}`,
        `运费：${shippingFee === 'ASK' ? '请问我查询运费' : `RM ${money(shippingFee)}`}`,
        ``,
        `收件人资料：`,
        `名字：${name || '-'}`,
        `电话：${phone || '-'}`,
        `地址：${address || '-'}`,
        `Postcode：${postcode || '-'}`,
        `州属：${state || '-'}`,
        ``,
        `物品：`,
        ...itemLines,
        `货品总额：RM ${money(normalTotal + bundleTotal)}`,
        `运费：${shippingFee === 'ASK' ? '请问我查询运费' : `RM ${money(shippingFee)}`}`,
        `总数：RM ${money(total)}`,
      ].join('\n')
    }

    if (delivery === 'LALAMOVE') {
      return [
        `配送方式：LALAMOVE`,
        `地区：${state || 'Klang Valley'}`,
        `运费：RM ${money(shippingFee)}`,
        ``,
        `收件人资料：`,
        `名字：${name || '-'}`,
        `电话：${phone || '-'}`,
        `地址：${address || '-'}`,
        ``,
        `物品：`,
        ...itemLines,
        `货品总额：RM ${money(normalTotal + bundleTotal)}`,
        `运费：RM ${money(shippingFee)}`,
        `总数：RM ${money(total)}`,
      ].join('\n')
    }

    return [
      `配送方式：自取`,
      `ORDER ID：${oid}`,
      `自取日期：${date || '-'}`,
      `自取时间：${time || '-'}`,
      ``,
      `物品：`,
      ...itemLines,
      `总额：RM ${money(total)}`,
    ].join('\n')
  }

  const livePreview = useMemo(() => {
    if (cart.length === 0 && !selectedBundle) return ''
    return buildCopiedSummary(orderId || 'PREVIEW')
  }, [
    cart,
    selectedBundle,
    bundleSelect,
    delivery,
    orderId,
    date,
    time,
    name,
    phone,
    address,
    state,
    postcode,
    shipping,
    normalTotal,
    bundleTotal,
    total,
    shippingFee,
    region,
    products,
  ])

  async function copyText(text) {
    if (!text || !String(text).trim()) {
      throw new Error('没有可复制的内容')
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-999999px'
    textarea.style.top = '-999999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    const ok = document.execCommand('copy')
    textarea.remove()

    if (!ok) {
      throw new Error('复制失败')
    }
  }

  async function handleCopyPreview() {
    try {
      await copyText(livePreview || '')
      setPreviewCopied(true)
      setTimeout(() => setPreviewCopied(false), 1500)
    } catch (err) {
      console.error(err)
      alert('没有可复制的预览内容')
    }
  }

  async function handleCopySummary() {
    try {
      await copyText(copiedPreview || '')
      setSummaryCopied(true)
      setTimeout(() => setSummaryCopied(false), 1500)
    } catch (err) {
      console.error(err)
      alert('没有可复制的订单摘要')
    }
  }

  async function submit(e) {
    e.preventDefault()

    if (!agentInfo) {
      setError('代理链接无效')
      return
    }

    if (cart.length === 0 && !selectedBundle) {
      setError('请选择产品或bundle')
      return
    }

    if (delivery === '自取') {
      if (!date || !time) {
        setError('请选择自取日期和时间')
        return
      }
    }

    if (delivery !== '自取') {
      if (!name || !phone || !address) {
        setError('请填写完整收件资料')
        return
      }
    }

    if (delivery === '邮寄') {
      if (!state) {
        setError('请选择州属')
        return
      }
      if (!postcode) {
        setError('请输入 postcode')
        return
      }
    }

    if (selectedBundle) {
      if (bundleCount !== bundleLimit) {
        setError('bundle 数量不正确')
        return
      }
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const prefix = agentInfo.code || agentInfo.agent_name
      const count = agentInfo.order_counter || 1
      const oid = `${prefix}-${String(count).padStart(4, '0')}`

      const { error: agentUpdateError } = await supabase
        .from('agents')
        .update({ order_counter: count + 1 })
        .eq('id', agentInfo.id)

      if (agentUpdateError) throw agentUpdateError

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          agent_name: prefix,
          delivery_method: delivery,
          pickup_order_id: oid,
          pickup_date: delivery === '自取' ? date || null : null,
          pickup_time: delivery === '自取' ? time || null : null,
          recipient_name: name || null,
          recipient_phone: phone || null,
          recipient_address: address || null,
          state: state || null,
          postcode: postcode || null,
          shipping_fee: shippingFee === 'ASK' ? null : shippingFee,
          total_amount: total,
        })
        .select()
        .single()

      if (orderError) throw orderError

      const items = []

      cart.forEach((i) => {
        items.push({
          order_id: order.id,
          product_id: i.id,
          product_name: cleanProductName(i),
          qty: i.qty,
          unit_price: i.price,
          subtotal: Number(i.qty || 0) * Number(i.price || 0),
        })
      })

      if (selectedBundle) {
        Object.entries(bundleSelect).forEach(([pid, qty]) => {
          const p = products.find((x) => String(x.id) === String(pid))
          if (!p || !qty) return

          items.push({
            order_id: order.id,
            product_id: p.id,
            product_name: cleanProductName(p),
            qty,
            unit_price: 0,
            subtotal: 0,
            item_type: 'BUNDLE_ITEM',
            bundle_rule_id: selectedBundle.id,
            bundle_name: selectedBundle.name,
          })
        })
      }

      const { error: itemError } = await supabase.from('order_items').insert(items)
      if (itemError) throw itemError

      for (const i of cart) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: Number(i.stock || 0) - Number(i.qty || 0) })
          .eq('id', i.id)

        if (stockError) throw stockError
      }

      if (selectedBundle) {
        for (const [pid, qty] of Object.entries(bundleSelect)) {
          const p = products.find((x) => String(x.id) === String(pid))
          if (!p || !qty) continue

          const { error: bundleStockError } = await supabase
            .from('products')
            .update({ stock: Number(p.stock || 0) - Number(qty || 0) })
            .eq('id', p.id)

          if (bundleStockError) throw bundleStockError
        }
      }

      const copiedSummary = buildCopiedSummary(oid)
      setCopiedPreview(copiedSummary)

      try {
        await copyText(copiedSummary)
        setSuccess(`成功：${oid}（订单摘要已复制）`)
      } catch {
        setSuccess(`成功：${oid}`)
      }

      resetFormAfterSubmit()
      await init()
    } catch (err) {
      let message = '提交失败'

      if (typeof err === 'string') {
        message = err
      } else if (err?.message) {
        message = err.message
      } else if (err?.error_description) {
        message = err.error_description
      } else if (err?.details) {
        message = err.details
      } else if (err?.hint) {
        message = err.hint
      } else {
        try {
          message = JSON.stringify(err)
        } catch {
          message = '提交失败'
        }
      }

      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffaf5_0%,#f7efe6_35%,#f2e5d9_70%,#ead8c7_100%)] text-[#5c4333]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-80px] top-[-60px] h-72 w-72 rounded-full bg-[#f8e7d5]/60 blur-3xl" />
        <div className="absolute right-[-60px] top-20 h-72 w-72 rounded-full bg-[#ead0b8]/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#f3dfcd]/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[30px] border border-[#eadacb] bg-white/75 shadow-[0_20px_60px_rgba(121,88,63,0.12)] backdrop-blur">
          <div className="border-b border-[#efe3d8] bg-[linear-gradient(90deg,#f8efe6_0%,#f5e7da_45%,#f1dfcf_100%)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#a07857]">
                  <PawPrint />
                  Agent Order Portal
                  <PawPrint />
                </div>

                <h1 className="mt-2 text-2xl font-black tracking-wide text-[#5f4432] md:text-4xl">
                  {agentInfo?.agent_name || agentInfo?.code || '欢迎下单'}
                </h1>

                <p className="mt-2 text-sm text-[#9b7b63]">
                  奶咖可爱风代理下单页 · 分类 / 品牌 / 口味或颜色
                </p>
              </div>

              <div className="flex items-center gap-3 text-4xl md:text-5xl">
                <span>🐶</span>
                <span>🦴</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-4">
            <div className="rounded-3xl border border-[#dff0f4] bg-[#f1fbfd] p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-cyan-700">IN STOCK</div>
              <div className="mt-2 text-3xl font-black text-cyan-700">{inStockCount}</div>
            </div>

            <div className="rounded-3xl border border-[#f4e6c8] bg-[#fff9ed] p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-700">LOW STOCK</div>
              <div className="mt-2 text-3xl font-black text-amber-700">{lowStockCount}</div>
            </div>

            <div className="rounded-3xl border border-[#f5d8d8] bg-[#fff4f4] p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-red-600">OUT OF STOCK</div>
              <div className="mt-2 text-3xl font-black text-red-600">{outStockCount}</div>
            </div>

            <div className="rounded-3xl border border-[#eadccf] bg-[#fbf6f1] p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[#8a6247]">CART ITEMS</div>
              <div className="mt-2 text-3xl font-black text-[#7b5740]">{cartQty}</div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[30px] border border-[#eadacb] bg-white/80 p-5 shadow-[0_15px_45px_rgba(121,88,63,0.10)] backdrop-blur">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#b08867]">
                    <PawPrint />
                    Filter
                  </div>
                  <h2 className="mt-2 text-xl font-black text-[#5f4432]">Products</h2>
                </div>

                <div className="w-full md:w-[320px]">
                  <input
                    type="text"
                    placeholder="Search 分类 / 品牌 / 口味 / 颜色"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-sm text-[#5c4333] outline-none placeholder:text-[#b29a88] focus:border-[#d7bda5]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[#a88b77]">
                    1. 分类
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {typeOptions.map((t) => (
                      <FilterButton
                        key={t}
                        active={selectedType === t}
                        onClick={() => {
                          setSelectedType(t)
                          setSelectedBrand('')
                          setSelectedVariant('')
                        }}
                      >
                        {t}
                      </FilterButton>
                    ))}
                  </div>
                </div>

                {selectedType ? (
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[#a88b77]">
                      2. 品牌
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {brandOptions.map((b) => (
                        <FilterButton
                          key={b}
                          active={selectedBrand === b}
                          onClick={() => {
                            setSelectedBrand(b)
                            setSelectedVariant('')
                          }}
                        >
                          {b}
                        </FilterButton>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedType && selectedBrand ? (
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[#a88b77]">
                      3. {currentVariantLabel}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {variantOptions.map((f) => (
                        <FilterButton
                          key={f}
                          active={selectedVariant === f}
                          onClick={() => setSelectedVariant(f)}
                        >
                          {f}
                        </FilterButton>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 mb-4 text-sm text-[#a08874]">
                {selectedVariant
                  ? `Showing ${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`
                  : `请选择${currentVariantLabel}后显示产品`}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((p) => {
                  const stockInfo = stockLabel(p.stock)
                  const displayPrice = getAgentPrice(p)
                  const displayName = cleanProductName(p)

                  return (
                    <div
                      key={p.id}
                      className={`group rounded-[26px] border border-[#eadacb] bg-[linear-gradient(180deg,#fffdfb_0%,#fcf6f0_100%)] p-4 transition duration-200 shadow-sm ${cardGlow(
                        p.stock
                      )}`}
                    >
                      <div className="mb-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b0947f]">
                            {getProductType(p)} · {p.brand || 'NO BRAND'}
                          </div>
                          <div className="mt-2 line-clamp-2 text-base font-bold text-[#5f4432]">
                            {displayName}
                          </div>
                          <div className="mt-1 text-xs text-[#a88b77]">
                            {p.series || '-'} · {getVariantLabel(p)}
                          </div>
                        </div>

                        <div className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${stockInfo.badge}`}>
                          {stockInfo.text}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#b0947f]">
                            Agent Price
                          </div>
                          <div className="mt-2 text-xl font-black text-[#7b5740]">
                            RM {money(displayPrice)}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#b0947f]">
                            Stock
                          </div>
                          <div className="mt-2 text-xl font-black text-[#5f4432]">
                            {Number(p.stock || 0)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => add(p)}
                        disabled={Number(p.stock || 0) <= 0 || Number(displayPrice) <= 0}
                        className="mt-4 w-full rounded-3xl border border-[#d2b49c] bg-[#dcc0a8] px-4 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-[#cfaf93] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Add To Cart
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-[30px] border border-[#eadacb] bg-white/80 p-5 shadow-[0_15px_45px_rgba(121,88,63,0.10)] backdrop-blur">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#b08867]">
                  <PawPrint />
                  Promotion
                </div>
                <h2 className="mt-2 text-xl font-black text-[#5f4432]">Bundle</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {bundles.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBundle(b)
                      setBundleSelect({})
                      setBundleSearch('')
                    }}
                    className={`rounded-3xl border px-4 py-3 text-sm font-bold transition ${
                      selectedBundle?.id === b.id
                        ? 'border-[#ba9070] bg-[#cfae95] text-white'
                        : 'border-[#eadacb] bg-[#fffaf6] text-[#7a5b47] hover:bg-[#f8efe6]'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>

              {selectedBundle ? (
                <div className="mt-5 space-y-4">
                  <div className="sticky top-0 z-10 rounded-3xl border border-[#eadacb] bg-[#fbf6f1]/95 p-4 backdrop-blur">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-3">
                          <div className="rounded-2xl border border-[#eadacb] bg-white px-4 py-3 text-sm text-[#8c654a]">
                            Bundle Price: <span className="font-bold text-[#6e4d36]">RM {money(bundleTotal)}</span>
                          </div>

                          <div className="rounded-2xl border border-[#eadacb] bg-white px-4 py-3 text-sm text-[#8c654a]">
                            Need: <span className="font-bold text-[#5f4432]">{bundleLimit}</span>
                          </div>

                          <div className="rounded-2xl border border-[#eadacb] bg-white px-4 py-3 text-sm text-[#8c654a]">
                            Selected: <span className="font-bold text-[#5f4432]">{bundleCount}</span>
                          </div>

                          <div className="rounded-2xl border border-[#eadacb] bg-white px-4 py-3 text-sm text-[#8c654a]">
                            Remaining: <span className="font-bold text-[#5f4432]">{bundleRemaining}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setBundleSelect({})}
                          className="rounded-3xl border border-[#eadacb] bg-white px-4 py-2 text-sm text-[#7a5b47] hover:bg-[#f8efe6]"
                        >
                          Clear Bundle
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <input
                          type="text"
                          placeholder="Search bundle flavour / color"
                          value={bundleSearch}
                          onChange={(e) => setBundleSearch(e.target.value)}
                          className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-sm text-[#5c4333] outline-none placeholder:text-[#b29a88] focus:border-[#d7bda5]"
                        />

                        <div className="rounded-3xl border border-[#eadacb] bg-white px-4 py-3 text-sm text-[#8c654a]">
                          {selectedBundleItems.length > 0
                            ? `已选口味 ${selectedBundleItems.length} 项`
                            : '未选任何口味'}
                        </div>
                      </div>

                      {selectedBundleItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedBundleItems.map((p) => (
                            <button
                              key={`selected-${p.id}`}
                              type="button"
                              onClick={() => setBundleQty(p.id, 0)}
                              className="rounded-full border border-[#cba98a] bg-[#dcc0a8] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#cfaf93]"
                            >
                              {p.__displayName} × {bundleSelect[p.id] || 0}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {sortedBundleProducts.map((p) => {
                      const stockInfo = stockLabel(p.stock)
                      const displayName = p.__displayName
                      const qty = Number(bundleSelect[p.id] || 0)
                      const selected = qty > 0

                      return (
                        <div
                          key={p.id}
                          className={`rounded-[22px] border bg-[linear-gradient(180deg,#fffdfb_0%,#fcf6f0_100%)] p-3 transition ${
                            selected
                              ? 'border-[#cba98a] ring-2 ring-[#ecd8c6]'
                              : 'border-[#eadacb]'
                          }`}
                        >
                          <div className="flex h-full flex-col justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b0947f]">
                                {p.brand || 'NO BRAND'} {p.series ? `• ${p.series}` : ''}
                              </div>

                              <div className="mt-2 min-h-[48px] text-base font-bold leading-6 text-[#5f4432]">
                                {displayName}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <div className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${stockInfo.badge}`}>
                                  {stockInfo.text}
                                </div>

                                <div className="text-xs text-[#a88b77]">Stock: {p.stock}</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => changeBundleQty(p.id, -1, p.stock)}
                                className="h-9 w-9 rounded-2xl border border-[#eadacb] bg-white text-base text-[#6c513d] transition hover:bg-[#f8efe6]"
                              >
                                -
                              </button>

                              <input
                                type="number"
                                min="0"
                                value={qty}
                                onChange={(e) => setBundleQty(p.id, e.target.value)}
                                className="h-9 w-16 rounded-2xl border border-[#eadacb] bg-white px-2 text-center text-[#5c4333] outline-none focus:border-[#cfae95]"
                              />

                              <button
                                type="button"
                                onClick={() => changeBundleQty(p.id, 1, p.stock)}
                                disabled={qty >= Number(p.stock || 0) || bundleCount >= bundleLimit}
                                className="h-9 w-9 rounded-2xl border border-[#eadacb] bg-white text-base text-[#6c513d] transition hover:bg-[#f8efe6] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[30px] border border-[#eadacb] bg-white/80 p-5 shadow-[0_15px_45px_rgba(121,88,63,0.10)] backdrop-blur">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#b08867]">
                  <PawPrint />
                  Delivery
                </div>
                <h2 className="mt-2 text-xl font-black text-[#5f4432]">Order Info</h2>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDelivery('邮寄')
                    setDate('')
                    setTime('')
                  }}
                  className={`rounded-3xl border px-3 py-3 text-sm font-bold transition ${
                    delivery === '邮寄'
                      ? 'border-[#cba98a] bg-[#dcc0a8] text-white'
                      : 'border-[#eadacb] bg-[#fffaf6] text-[#7a5b47] hover:bg-[#f8efe6]'
                  }`}
                >
                  邮寄
                </button>

                <button
                  type="button"
                  onClick={() => setDelivery('自取')}
                  className={`rounded-3xl border px-3 py-3 text-sm font-bold transition ${
                    delivery === '自取'
                      ? 'border-[#cba98a] bg-[#dcc0a8] text-white'
                      : 'border-[#eadacb] bg-[#fffaf6] text-[#7a5b47] hover:bg-[#f8efe6]'
                  }`}
                >
                  自取
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDelivery('LALAMOVE')
                    setDate('')
                    setTime('')
                  }}
                  className={`rounded-3xl border px-3 py-3 text-sm font-bold transition ${
                    delivery === 'LALAMOVE'
                      ? 'border-[#cba98a] bg-[#dcc0a8] text-white'
                      : 'border-[#eadacb] bg-[#fffaf6] text-[#7a5b47] hover:bg-[#f8efe6]'
                  }`}
                >
                  LALAMOVE
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                    Order ID
                  </label>
                  <input
                    value={orderId}
                    readOnly
                    className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none"
                  />
                </div>

                {delivery === '自取' && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                        Pickup Date
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none focus:border-[#cfae95]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                        Pickup Time
                      </label>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none focus:border-[#cfae95]"
                      />
                    </div>
                  </div>
                )}

                {delivery !== '自取' && (
                  <>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        placeholder="收件人名字"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none placeholder:text-[#b29a88] focus:border-[#cfae95]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                        Phone
                      </label>
                      <input
                        type="text"
                        placeholder="收件人电话"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none placeholder:text-[#b29a88] focus:border-[#cfae95]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                        Address
                      </label>
                      <textarea
                        placeholder="收件地址"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="min-h-[110px] w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none placeholder:text-[#b29a88] focus:border-[#cfae95]"
                      />
                    </div>
                  </>
                )}

                {delivery === '邮寄' && (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                          Postcode
                        </label>
                        <input
                          type="text"
                          placeholder="Postcode"
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none placeholder:text-[#b29a88] focus:border-[#cfae95]"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                          State
                        </label>
                        <select
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none focus:border-[#cfae95]"
                        >
                          <option value="">选择州属</option>
                          {STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#eadacb] bg-[#fbf6f1] px-4 py-3 text-sm text-[#8a6d59]">
                      Region: <span className="font-semibold text-[#5f4432]">{region}</span>
                    </div>

                    <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-sm text-[#8a6d59]">
                      Shipping Fee:{' '}
                      <span className="font-semibold text-[#5f4432]">{shippingText()}</span>
                    </div>
                  </>
                )}

                {delivery === 'LALAMOVE' && (
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                      Lalamove Fee
                    </label>
                    <input
                      type="number"
                      placeholder="Lalamove Fee"
                      value={shipping}
                      onChange={(e) => setShipping(e.target.value)}
                      className="w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-[#5c4333] outline-none placeholder:text-[#b29a88] focus:border-[#cfae95]"
                    />
                  </div>
                )}

                {error ? (
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="rounded-3xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600">
                    {success}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[30px] border border-[#eadacb] bg-white/80 p-5 shadow-[0_15px_45px_rgba(121,88,63,0.10)] backdrop-blur">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#b08867]">
                  <PawPrint />
                  Selected
                </div>
                <h2 className="mt-2 text-xl font-black text-[#5f4432]">Cart</h2>
              </div>

              {cart.length === 0 ? (
                <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-4 text-sm text-[#a08874]">
                  还没有普通产品
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="rounded-[26px] border border-[#eadacb] bg-[linear-gradient(180deg,#fffdfb_0%,#fcf6f0_100%)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b0947f]">
                            {getProductType(item)} · {item.brand || 'NO BRAND'} {item.series ? `• ${item.series}` : ''}
                          </div>
                          <div className="mt-2 text-base font-bold text-[#5f4432]">{cleanProductName(item)}</div>
                          <div className="mt-2 text-sm text-[#7b5740]">RM {money(item.price)}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeCart(item.id)}
                          className="rounded-3xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-500 hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeCartQty(item.id, item.qty - 1)}
                          className="h-11 w-11 rounded-3xl border border-[#eadacb] bg-white text-lg text-[#6c513d] hover:bg-[#f8efe6]"
                        >
                          -
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={item.qty}
                          onChange={(e) => changeCartQty(item.id, e.target.value)}
                          className="h-11 w-24 rounded-3xl border border-[#eadacb] bg-white px-3 text-center text-[#5c4333] outline-none focus:border-[#cfae95]"
                        />

                        <button
                          type="button"
                          onClick={() => changeCartQty(item.id, item.qty + 1)}
                          className="h-11 w-11 rounded-3xl border border-[#eadacb] bg-white text-lg text-[#6c513d] hover:bg-[#f8efe6]"
                        >
                          +
                        </button>

                        <div className="ml-auto text-sm text-[#8b7260]">
                          Subtotal:{' '}
                          <span className="font-bold text-[#5f4432]">
                            RM {money(Number(item.qty || 0) * Number(item.price || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[30px] border border-[#eadacb] bg-white/80 p-5 shadow-[0_15px_45px_rgba(121,88,63,0.10)] backdrop-blur">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#b08867]">
                  <PawPrint />
                  Checkout
                </div>
                <h2 className="mt-2 text-xl font-black text-[#5f4432]">Summary</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3">
                  <span className="text-[#8b7260]">Cart Items</span>
                  <span className="font-bold text-[#5f4432]">{cartQty}</span>
                </div>

                <div className="flex items-center justify-between rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3">
                  <span className="text-[#8b7260]">Normal Products</span>
                  <span className="font-bold text-[#5f4432]">RM {money(normalTotal)}</span>
                </div>

                <div className="flex items-center justify-between rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3">
                  <span className="text-[#8b7260]">Bundle</span>
                  <span className="font-bold text-[#5f4432]">RM {money(bundleTotal)}</span>
                </div>

                <div className="flex items-center justify-between rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3">
                  <span className="text-[#8b7260]">Shipping</span>
                  <span className="font-bold text-[#5f4432]">{shippingText()}</span>
                </div>

                <div className="flex items-center justify-between rounded-3xl border border-[#d8c2aa] bg-[linear-gradient(90deg,#f6eadf_0%,#edd8c4_100%)] px-4 py-4">
                  <span className="text-[#7a563d]">Total</span>
                  <span className="text-2xl font-black text-[#6a4a34]">RM {money(total)}</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-3xl border border-[#d2b49c] bg-[#dcc0a8] px-4 py-4 text-sm font-black tracking-[0.18em] text-white transition hover:bg-[#cfaf93] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Order'}
                </button>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                    Order Summary Preview
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPreview}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      previewCopied
                        ? 'border-green-200 bg-green-50 text-green-600'
                        : 'border-[#d9c2af] bg-[#fffaf5] text-[#7a5a45] hover:bg-[#f8efe6]'
                    }`}
                  >
                    {previewCopied ? '已复制' : '一键复制'}
                  </button>
                </div>

                <textarea
                  value={livePreview || '请选择产品后，这里会自动显示订单预览'}
                  readOnly
                  className="min-h-[260px] w-full rounded-3xl border border-[#b6e07b] bg-[#97e067] px-4 py-3 text-sm text-[#17320d] outline-none"
                />
              </div>

              {copiedPreview ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a88b77]">
                      Copied Summary
                    </div>

                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        summaryCopied
                          ? 'border-green-200 bg-green-50 text-green-600'
                          : 'border-[#d9c2af] bg-[#fffaf5] text-[#7a5a45] hover:bg-[#f8efe6]'
                      }`}
                    >
                      {summaryCopied ? '已复制' : '一键复制'}
                    </button>
                  </div>

                  <textarea
                    value={copiedPreview}
                    readOnly
                    className="min-h-[220px] w-full rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-xs text-[#6f5746] outline-none"
                  />
                </div>
              ) : null}
            </section>
          </div>
        </form>
      </div>
    </main>
  )
}