'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const DELIVERY_METHODS = [
  { value: 'SELF_PICKUP', label: '自取' },
  { value: 'POSTAGE', label: '邮寄' },
  { value: 'LALAMOVE', label: 'Lalamove' },
]

const MALAYSIA_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
]

const EAST_MALAYSIA_STATES = ['SABAH', 'SARAWAK', 'LABUAN']
const POSTAGE_HEAVY_QTY_LIMIT = 10

function money(value) {
  return Number(value || 0).toFixed(2)
}

function num(value) {
  return Number(value || 0)
}

function normalizeText(value) {
  return (value || '').toString().trim()
}

function makeBundleGroupKey() {
  return `BG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getShippingRegionByState(stateName) {
  const s = normalizeText(stateName).toUpperCase()
  if (!s) return ''

  if (EAST_MALAYSIA_STATES.includes(s)) return 'East Malaysia'
  return 'West Malaysia'
}

function CorgiBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs text-amber-900 shadow-sm">
      <span>🐶</span>
      <span>corgi mode</span>
    </div>
  )
}

export default function AgentOrderPage() {
  const params = useParams()
  const agentSlug = normalizeText(params?.agent || '').toLowerCase()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [agentInfo, setAgentInfo] = useState(null)

  const [products, setProducts] = useState([])
  const [bundleRules, setBundleRules] = useState([])
  const [bundleProductMap, setBundleProductMap] = useState({})

  const [deliveryMethod, setDeliveryMethod] = useState('SELF_PICKUP')

  const [pickupOrderId, setPickupOrderId] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')

  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [stateName, setStateName] = useState('')
  const [shippingFee, setShippingFee] = useState('')

  const [lalamoveFee, setLalamoveFee] = useState('')
  const [remark, setRemark] = useState('')

  const [cart, setCart] = useState([])
  const [selectedBundleId, setSelectedBundleId] = useState('')
  const [bundleSelections, setBundleSelections] = useState({})

  useEffect(() => {
    if (!agentSlug) return
    loadInitialData()
  }, [agentSlug])

  async function loadInitialData() {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const { data: agentRow, error: agentError } = await supabase
        .from('agents')
        .select('id, code, name, slug, is_active, agent_name, order_counter, order_prefix')
        .or(`slug.eq.${agentSlug},agent_slug.eq.${agentSlug}`)
        .eq('is_active', true)
        .single()

      if (agentError) throw agentError

      const { data: productRows, error: productError } = await supabase
        .from('products')
        .select('id, name, brand, series, flavor, stock, price, is_active')
        .eq('is_active', true)
        .order('brand', { ascending: true })
        .order('series', { ascending: true })
        .order('name', { ascending: true })

      if (productError) throw productError

      const { data: bundleRows, error: bundleError } = await supabase
        .from('bundle_rules')
        .select('id, name, brand, series, buy_qty, free_qty, min_select_qty, bundle_price, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (bundleError) throw bundleError

      const { data: linkRows, error: linkError } = await supabase
        .from('bundle_rule_products')
        .select('bundle_rule_id, product_id')

      if (linkError) throw linkError

      const nextMap = {}
      for (const row of linkRows || []) {
        if (!nextMap[row.bundle_rule_id]) nextMap[row.bundle_rule_id] = []
        nextMap[row.bundle_rule_id].push(row.product_id)
      }

      setAgentInfo(agentRow)
      setProducts(productRows || [])
      setBundleRules(bundleRows || [])
      setBundleProductMap(nextMap)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  const activeProducts = useMemo(() => {
    return (products || []).filter((p) => num(p.stock) > 0)
  }, [products])

  const selectedBundle = useMemo(() => {
    return bundleRules.find((b) => b.id === selectedBundleId) || null
  }, [bundleRules, selectedBundleId])

  useEffect(() => {
    if (deliveryMethod !== 'SELF_PICKUP') return
    if (!agentInfo) return

    const prefix = normalizeText(
      agentInfo.order_prefix || agentInfo.code || agentInfo.agent_name || 'AGENT'
    ).toUpperCase()

    const currentCounter = num(agentInfo.order_counter) || 1
    const previewNo = String(currentCounter).padStart(4, '0')

    setPickupOrderId(`${prefix}-${previewNo}`)
  }, [deliveryMethod, agentInfo])

  const availableBundleProducts = useMemo(() => {
    if (!selectedBundle) return []

    const linkedIds = bundleProductMap[selectedBundle.id] || []

    if (linkedIds.length > 0) {
      return activeProducts.filter((p) => linkedIds.includes(p.id))
    }

    return activeProducts.filter((p) => {
      const brandOk = selectedBundle.brand ? p.brand === selectedBundle.brand : true
      const seriesOk = selectedBundle.series ? p.series === selectedBundle.series : true
      return brandOk && seriesOk
    })
  }, [selectedBundle, bundleProductMap, activeProducts])

  const normalCartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + num(item.qty) * num(item.price), 0)
  }, [cart])

  const bundleSelectedQty = useMemo(() => {
    return Object.values(bundleSelections).reduce((sum, qty) => sum + num(qty), 0)
  }, [bundleSelections])

  const bundleTotal = useMemo(() => {
    if (!selectedBundle) return 0
    return num(selectedBundle.bundle_price)
  }, [selectedBundle])

  const totalItemQty = useMemo(() => {
    const normalQty = cart.reduce((sum, item) => sum + num(item.qty), 0)
    return normalQty + bundleSelectedQty
  }, [cart, bundleSelectedQty])

  const shippingRegion = useMemo(() => {
    if (deliveryMethod !== 'POSTAGE') return ''
    return getShippingRegionByState(stateName)
  }, [deliveryMethod, stateName])

  const finalShippingFee = useMemo(() => {
    if (deliveryMethod === 'POSTAGE') return num(shippingFee)
    if (deliveryMethod === 'LALAMOVE') return num(lalamoveFee)
    return 0
  }, [deliveryMethod, shippingFee, lalamoveFee])

  const grandTotal = useMemo(() => {
    return normalCartTotal + bundleTotal + finalShippingFee
  }, [normalCartTotal, bundleTotal, finalShippingFee])

  const postageNeedManualCheck = useMemo(() => {
    return deliveryMethod === 'POSTAGE' && totalItemQty > POSTAGE_HEAVY_QTY_LIMIT
  }, [deliveryMethod, totalItemQty])

  function addProductToCart(product) {
    setCart((prev) => {
      const found = prev.find((x) => x.id === product.id)

      if (found) {
        const nextQty = found.qty + 1
        if (nextQty > num(product.stock)) return prev

        return prev.map((x) =>
          x.id === product.id ? { ...x, qty: nextQty } : x
        )
      }

      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          brand: product.brand,
          series: product.series,
          flavor: product.flavor,
          price: num(product.price),
          stock: num(product.stock),
          qty: 1,
        },
      ]
    })
  }

  function updateCartQty(productId, qty) {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id !== productId) return item

          let nextQty = num(qty)
          if (nextQty < 0) nextQty = 0
          if (nextQty > item.stock) nextQty = item.stock

          return { ...item, qty: nextQty }
        })
        .filter((item) => item.qty > 0)
    })
  }

  function removeCartItem(productId) {
    setCart((prev) => prev.filter((item) => item.id !== productId))
  }

  function handleBundleChange(bundleId) {
    setSelectedBundleId(bundleId)
    setBundleSelections({})
  }

  function setBundleProductQty(productId, qty) {
    if (!selectedBundle) return

    const safeQty = Math.max(0, num(qty))
    const product = availableBundleProducts.find((p) => p.id === productId)
    if (!product) return
    if (safeQty > num(product.stock)) return

    const draft = {
      ...bundleSelections,
      [productId]: safeQty,
    }

    const totalAfter = Object.values(draft).reduce((sum, v) => sum + num(v), 0)
    const maxAllowed = num(selectedBundle.min_select_qty)

    if (totalAfter > maxAllowed) return

    if (safeQty === 0) {
      delete draft[productId]
    }

    setBundleSelections(draft)
  }

  function validateOrder() {
    if (!agentInfo) return 'Agent link is invalid.'
    if (cart.length === 0 && !selectedBundle) {
      return 'Please add at least one product or one bundle.'
    }

    if (deliveryMethod === 'SELF_PICKUP') {
      if (!normalizeText(pickupOrderId)) return 'Pickup Order ID failed to generate.'
      if (!pickupDate) return 'Please choose pickup date.'
      if (!pickupTime) return 'Please choose pickup time.'
    }

    if (deliveryMethod === 'POSTAGE') {
      if (!normalizeText(recipientName)) return 'Please enter recipient name.'
      if (!normalizeText(recipientPhone)) return 'Please enter recipient phone.'
      if (!normalizeText(recipientAddress)) return 'Please enter recipient address.'
      if (!normalizeText(postcode)) return 'Please enter postcode.'
      if (!normalizeText(stateName)) return 'Please select state.'
    }

    if (deliveryMethod === 'LALAMOVE') {
      if (!normalizeText(recipientName)) return 'Please enter recipient name.'
      if (!normalizeText(recipientPhone)) return 'Please enter recipient phone.'
      if (!normalizeText(recipientAddress)) return 'Please enter recipient address.'
    }

    if (selectedBundle) {
      const needQty = num(selectedBundle.min_select_qty)

      if (bundleSelectedQty !== needQty) {
        return `Bundle "${selectedBundle.name}" must select exactly ${needQty} items.`
      }

      const selectedIds = Object.keys(bundleSelections)
      if (selectedIds.length === 0) return 'Please choose bundle items.'

      for (const productId of selectedIds) {
        const product = availableBundleProducts.find((p) => p.id === productId)
        if (!product) return 'Bundle contains invalid product.'

        const qty = num(bundleSelections[productId])
        if (qty > num(product.stock)) {
          return `${product.name} stock is not enough.`
        }
      }
    }

    for (const item of cart) {
      if (num(item.qty) > num(item.stock)) {
        return `${item.name} stock is not enough.`
      }
    }

    return ''
  }

  function resetForm() {
    setDeliveryMethod('SELF_PICKUP')
    setPickupOrderId('')
    setPickupDate('')
    setPickupTime('')
    setRecipientName('')
    setRecipientPhone('')
    setRecipientAddress('')
    setPostcode('')
    setStateName('')
    setShippingFee('')
    setLalamoveFee('')
    setRemark('')
    setCart([])
    setSelectedBundleId('')
    setBundleSelections({})
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const validationError = validateOrder()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      let finalPickupOrderId = null

      if (deliveryMethod === 'SELF_PICKUP') {
        const currentCounter = num(agentInfo?.order_counter) || 1
        const prefix = normalizeText(
          agentInfo?.order_prefix || agentInfo?.code || agentInfo?.agent_name || 'AGENT'
        ).toUpperCase()

        finalPickupOrderId = `${prefix}-${String(currentCounter).padStart(4, '0')}`

        const { error: counterError } = await supabase
          .from('agents')
          .update({ order_counter: currentCounter + 1 })
          .eq('id', agentInfo.id)

        if (counterError) throw counterError
      }

      const orderPayload = {
        agent_name: agentInfo?.code || agentInfo?.agent_name || null,
        delivery_method: deliveryMethod,

        pickup_order_id: deliveryMethod === 'SELF_PICKUP' ? finalPickupOrderId : null,
        pickup_date: deliveryMethod === 'SELF_PICKUP' ? pickupDate : null,
        pickup_time: deliveryMethod === 'SELF_PICKUP' ? pickupTime : null,

        recipient_name: deliveryMethod !== 'SELF_PICKUP' ? normalizeText(recipientName) : null,
        recipient_phone: deliveryMethod !== 'SELF_PICKUP' ? normalizeText(recipientPhone) : null,
        recipient_address: deliveryMethod !== 'SELF_PICKUP' ? normalizeText(recipientAddress) : null,

        postcode: deliveryMethod === 'POSTAGE' ? normalizeText(postcode) : null,
        state: deliveryMethod === 'POSTAGE' ? normalizeText(stateName) : null,
        shipping_region: deliveryMethod === 'POSTAGE' ? shippingRegion : null,
        shipping_fee: deliveryMethod === 'POSTAGE' ? num(shippingFee) : 0,

        lalamove_fee: deliveryMethod === 'LALAMOVE' ? num(lalamoveFee) : 0,

        remark: normalizeText(remark) || null,
        total_amount: grandTotal,
      }

      const { data: orderInsert, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select('id, order_no')
        .single()

      if (orderError) throw orderError

      const orderId = orderInsert.id
      const itemRows = []

      for (const item of cart) {
        itemRows.push({
          order_id: orderId,
          product_id: item.id,
          product_name: item.name,
          qty: num(item.qty),
          unit_price: num(item.price),
          subtotal: num(item.qty) * num(item.price),
          item_type: 'PRODUCT',
          bundle_rule_id: null,
          bundle_name: null,
          bundle_group_key: null,
        })
      }

      if (selectedBundle) {
        const bundleGroupKey = makeBundleGroupKey()

        for (const [productId, qtyValue] of Object.entries(bundleSelections)) {
          const qty = num(qtyValue)
          if (qty <= 0) continue

          const product = availableBundleProducts.find((p) => p.id === productId)
          if (!product) continue

          itemRows.push({
            order_id: orderId,
            product_id: product.id,
            product_name: product.name,
            qty,
            unit_price: 0,
            subtotal: 0,
            item_type: 'BUNDLE_ITEM',
            bundle_rule_id: selectedBundle.id,
            bundle_name: selectedBundle.name,
            bundle_group_key: bundleGroupKey,
          })
        }

        itemRows.push({
          order_id: orderId,
          product_id: null,
          product_name: selectedBundle.name,
          qty: 1,
          unit_price: num(selectedBundle.bundle_price),
          subtotal: num(selectedBundle.bundle_price),
          item_type: 'BUNDLE',
          bundle_rule_id: selectedBundle.id,
          bundle_name: selectedBundle.name,
          bundle_group_key: bundleGroupKey,
        })
      }

      if (itemRows.length > 0) {
        const { error: itemError } = await supabase
          .from('order_items')
          .insert(itemRows)

        if (itemError) throw itemError
      }

      const stockUpdatesMap = {}

      for (const item of cart) {
        stockUpdatesMap[item.id] = (stockUpdatesMap[item.id] || 0) + num(item.qty)
      }

      if (selectedBundle) {
        for (const [productId, qtyValue] of Object.entries(bundleSelections)) {
          stockUpdatesMap[productId] = (stockUpdatesMap[productId] || 0) + num(qtyValue)
        }
      }

      for (const productId of Object.keys(stockUpdatesMap)) {
        const product = products.find((p) => p.id === productId)
        if (!product) continue

        const deductQty = stockUpdatesMap[productId]
        const newStock = num(product.stock) - num(deductQty)

        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId)

        if (stockError) throw stockError
      }

      const messages = [`Order created: ${orderInsert.order_no || 'Saved'}`]
      if (finalPickupOrderId) {
        messages.push(`Pickup Order ID: ${finalPickupOrderId}`)
      }

      setSuccess(messages.join(' | '))
      resetForm()
      await loadInitialData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to submit order.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6efe8] p-6">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-8 shadow-sm">
          Loading...
        </div>
      </main>
    )
  }

  if (!agentInfo) {
    return (
      <main className="min-h-screen bg-[#f6efe8] p-6">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-8 text-center shadow-sm">
          Invalid agent link.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6efe8] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[30px] border border-[#e7d5c2] bg-gradient-to-r from-[#fff7f0] to-[#f2e2d1] p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#5f3d2e]">Agent Order System</h1>
              <p className="mt-2 text-sm text-[#7b5a49]">
                代理：{agentInfo.code || agentInfo.agent_name} {agentInfo.name ? `| ${agentInfo.name}` : ''}
              </p>
            </div>
            <CorgiBadge />
          </div>
        </div>

        {error ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 shadow-sm">
            {success}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#5f3d2e]">配送方式</h2>
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">选择配送方式</label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e] outline-none focus:border-[#b88b68]"
                >
                  {DELIVERY_METHODS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm">
              <div className="mb-4 border-b border-[#efdfd0] pb-3">
                <h2 className="text-lg font-semibold text-[#5f3d2e]">配送资料</h2>
              </div>

              {deliveryMethod === 'SELF_PICKUP' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Order ID</label>
                    <input
                      value={pickupOrderId}
                      readOnly
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-[#f8f1ea] px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">自取日期</label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">自取时间</label>
                    <input
                      type="time"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>
                </div>
              ) : null}

              {deliveryMethod === 'POSTAGE' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">收件人名字</label>
                    <input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">收件人电话</label>
                    <input
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">地址</label>
                    <textarea
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="min-h-[100px] w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Postcode</label>
                    <input
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">州 / State</label>
                    <select
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    >
                      <option value="">请选择州属</option>
                      {MALAYSIA_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Region</label>
                    <input
                      value={shippingRegion}
                      readOnly
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-[#f8f1ea] px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">邮费</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingFee}
                      onChange={(e) => setShippingFee(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                      placeholder="0.00"
                    />
                  </div>

                  {postageNeedManualCheck ? (
                    <div className="md:col-span-2 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                      🐶 总物品超过 {POSTAGE_HEAVY_QTY_LIMIT} 件，需要你查询运费。
                    </div>
                  ) : null}
                </div>
              ) : null}

              {deliveryMethod === 'LALAMOVE' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">收件人名字</label>
                    <input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">收件人电话</label>
                    <input
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">地址</label>
                    <textarea
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="min-h-[100px] w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                    />
                  </div>

                  <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-800">
                    🐶 请自行查询 Lalamove 运费，然后填写。
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Lalamove Fee</label>
                    <input
                      type="number"
                      step="0.01"
                      value={lalamoveFee}
                      onChange={(e) => setLalamoveFee(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm">
              <div className="mb-4 border-b border-[#efdfd0] pb-3">
                <h2 className="text-lg font-semibold text-[#5f3d2e]">Products</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeProducts.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-[24px] border border-[#e8d8c8] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-[#5f3d2e]">{product.name}</div>
                      <span className="rounded-full bg-[#f4e2d1] px-2 py-1 text-xs text-[#7a5642]">🐾</span>
                    </div>

                    <div className="mt-2 text-sm text-[#8b6a57]">
                      {product.brand || '-'} / {product.series || '-'} / {product.flavor || '-'}
                    </div>
                    <div className="mt-2 text-sm text-[#7b5a49]">Stock: {product.stock}</div>
                    <div className="mt-1 text-sm font-medium text-[#5f3d2e]">RM {money(product.price)}</div>

                    <button
                      type="button"
                      onClick={() => addProductToCart(product)}
                      className="mt-4 rounded-2xl bg-[#6f4b3e] px-4 py-2 text-white transition hover:bg-[#5f3d2e]"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm">
              <div className="mb-4 border-b border-[#efdfd0] pb-3">
                <h2 className="text-lg font-semibold text-[#5f3d2e]">Bundle</h2>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#7b5a49]">Choose Bundle</label>
                <select
                  value={selectedBundleId}
                  onChange={(e) => handleBundleChange(e.target.value)}
                  className="w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                >
                  <option value="">No bundle</option>
                  {bundleRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBundle ? (
                <div className="mt-4 rounded-[24px] border border-[#e8d8c8] bg-[#fbf4ed] p-4">
                  <div className="flex items-center gap-2">
                    <span>🐶</span>
                    <div className="font-semibold text-[#5f3d2e]">{selectedBundle.name}</div>
                  </div>
                  <div className="mt-2 text-sm text-[#7b5a49]">
                    Brand: {selectedBundle.brand || '-'} | Series: {selectedBundle.series || '-'}
                  </div>
                  <div className="mt-1 text-sm text-[#7b5a49]">
                    Buy {selectedBundle.buy_qty} Free {selectedBundle.free_qty} | Need choose {selectedBundle.min_select_qty} items
                  </div>
                  <div className="mt-1 text-sm text-[#7b5a49]">
                    Bundle Price: RM {money(selectedBundle.bundle_price)}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[#5f3d2e]">
                    Selected: {bundleSelectedQty} / {selectedBundle.min_select_qty}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {availableBundleProducts.map((product) => (
                      <div
                        key={product.id}
                        className="rounded-[22px] border border-[#e8d8c8] bg-white p-4 shadow-sm"
                      >
                        <div className="font-semibold text-[#5f3d2e]">{product.name}</div>
                        <div className="mt-2 text-sm text-[#8b6a57]">
                          {product.brand || '-'} / {product.series || '-'} / {product.flavor || '-'}
                        </div>
                        <div className="mt-2 text-sm text-[#7b5a49]">Stock: {product.stock}</div>

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-[#d9c3ae] bg-[#f8f1ea] px-3 py-1 text-[#5f3d2e]"
                            onClick={() =>
                              setBundleProductQty(product.id, num(bundleSelections[product.id]) - 1)
                            }
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min="0"
                            max={product.stock}
                            value={bundleSelections[product.id] || 0}
                            onChange={(e) => setBundleProductQty(product.id, e.target.value)}
                            className="w-20 rounded-xl border border-[#d9c3ae] px-3 py-1 text-center text-[#5f3d2e]"
                          />

                          <button
                            type="button"
                            className="rounded-xl border border-[#d9c3ae] bg-[#f8f1ea] px-3 py-1 text-[#5f3d2e]"
                            onClick={() =>
                              setBundleProductQty(product.id, num(bundleSelections[product.id]) + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {availableBundleProducts.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                      This bundle has no matched products. Please check bundle_rule_products.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm">
              <div className="mb-4 border-b border-[#efdfd0] pb-3">
                <h2 className="text-lg font-semibold text-[#5f3d2e]">Remark</h2>
              </div>

              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="min-h-[100px] w-full rounded-2xl border border-[#ddc7b3] bg-white px-4 py-3 text-[#5f3d2e]"
                placeholder="备注"
              />
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm">
              <div className="mb-4 border-b border-[#efdfd0] pb-3">
                <h2 className="text-lg font-semibold text-[#5f3d2e]">Cart</h2>
              </div>

              <div className="space-y-4">
                {cart.length === 0 ? (
                  <div className="text-sm text-[#8b6a57]">No normal products yet.</div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-[#e8d8c8] bg-white p-4 shadow-sm">
                      <div className="font-semibold text-[#5f3d2e]">{item.name}</div>
                      <div className="mt-2 text-sm text-[#8b6a57]">
                        RM {money(item.price)} × {item.qty}
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-[#d9c3ae] bg-[#f8f1ea] px-3 py-1 text-[#5f3d2e]"
                          onClick={() => updateCartQty(item.id, item.qty - 1)}
                        >
                          -
                        </button>

                        <input
                          type="number"
                          min="0"
                          max={item.stock}
                          value={item.qty}
                          onChange={(e) => updateCartQty(item.id, e.target.value)}
                          className="w-20 rounded-xl border border-[#d9c3ae] px-3 py-1 text-center text-[#5f3d2e]"
                        />

                        <button
                          type="button"
                          className="rounded-xl border border-[#d9c3ae] bg-[#f8f1ea] px-3 py-1 text-[#5f3d2e]"
                          onClick={() => updateCartQty(item.id, item.qty + 1)}
                        >
                          +
                        </button>

                        <button
                          type="button"
                          className="ml-auto rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-red-600"
                          onClick={() => removeCartItem(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {selectedBundle ? (
                  <div className="rounded-[22px] border border-[#d9c3ae] bg-[#f8f1ea] p-4">
                    <div className="font-semibold text-[#5f3d2e]">{selectedBundle.name}</div>
                    <div className="mt-1 text-sm text-[#7b5a49]">
                      Bundle Price: RM {money(selectedBundle.bundle_price)}
                    </div>
                    <div className="mt-1 text-sm text-[#7b5a49]">
                      Selected: {bundleSelectedQty} / {selectedBundle.min_select_qty}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#ead8c7] bg-[#fffaf5] p-6 shadow-sm">
              <div className="mb-4 border-b border-[#efdfd0] pb-3">
                <h2 className="text-lg font-semibold text-[#5f3d2e]">Order Summary</h2>
              </div>

              <div className="space-y-2 text-sm text-[#7b5a49]">
                <div className="flex items-center justify-between">
                  <span>Total Quantity</span>
                  <span>{totalItemQty}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Normal Products</span>
                  <span>RM {money(normalCartTotal)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Bundle</span>
                  <span>RM {money(bundleTotal)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Shipping / Delivery Fee</span>
                  <span>RM {money(finalShippingFee)}</span>
                </div>

                {deliveryMethod === 'POSTAGE' && shippingRegion ? (
                  <div className="flex items-center justify-between">
                    <span>Shipping Region</span>
                    <span>{shippingRegion}</span>
                  </div>
                ) : null}

                <div className="border-t border-[#efdfd0] pt-3 text-base font-bold text-[#5f3d2e]">
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    <span>RM {money(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 w-full rounded-2xl bg-[#6f4b3e] px-4 py-3 text-white transition hover:bg-[#5f3d2e] disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Order'}
              </button>
            </section>
          </aside>
        </form>
      </div>
    </main>
  )
}