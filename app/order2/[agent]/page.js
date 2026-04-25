'use client'
 
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
 
const STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'WP Kuala Lumpur',
  'WP Labuan',
  'Putrajaya',
]
const EAST = ['SABAH', 'SARAWAK', 'WP LABUAN']
 
const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION || '2026-04-25-1'
const VERSION_PARAM = '_v'
const REFRESH_PARAM = '_r'
const VERSION_STORAGE_KEY = 'order2_app_version'
const VERSION_RELOAD_GUARD_KEY = 'order2_app_version_reloaded'
 
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
 
function eqText(a, b) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase()
}
 
function getProductType(product) {
  const rawOriginal = normalizeText(
    product?.product_type ??
      product?.type ??
      product?.category ??
      product?.main_category ??
      ''
  )
 
  const raw = rawOriginal.toUpperCase()
 
  if (raw.includes('烟弹') || raw.includes('POD') || raw.includes('弹')) {
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
 
  if (!rawOriginal) return '未分类'
  return rawOriginal
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
 
  n = n.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
 
  return n || normalizeText(product?.name) || '-'
}
 
function getVariantLabel(product) {
  const type = getProductType(product)
  if (type === '烟杆') return '颜色'
  return '口味'
}
 
function splitBrandFlavor(brand, productName) {
  const safeBrand = normalizeText(brand)
  const safeProductName = normalizeText(productName)
 
  if (!safeBrand) {
    return {
      brandLine: '',
      flavorLine: safeProductName || '-',
    }
  }
 
  const escaped = safeBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const flavor = safeProductName.replace(new RegExp(`^${escaped}\\s*`, 'i'), '').trim()
 
  return {
    brandLine: safeBrand,
    flavorLine: flavor || safeProductName || '-',
  }
}
 
function getSummaryGroupName(item) {
  return normalizeText(item?.brand) || cleanProductName(item) || '-'
}
 
function getSummaryVariantName(item) {
  const cleanName = cleanProductName(item)
  const groupName = getSummaryGroupName(item)
 
  if (eqText(cleanName, groupName)) return normalizeText(item?.name) || cleanName || '-'
  return cleanName || normalizeText(item?.name) || '-'
}
 
function buildGroupedNormalItems(cartItems = []) {
  const groupMap = new Map()
 
  cartItems
    .filter((item) => !item.is_bundle)
    .forEach((item) => {
      const groupName = getSummaryGroupName(item)
      const groupKey = groupName.toLowerCase()
      const variantName = getSummaryVariantName(item)
      const price = Number(item.price || 0)
      const qty = Number(item.qty || 0)
      const itemSubtotal = qty * price
 
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          name: groupName,
          subtotal: 0,
          variants: new Map(),
        })
      }
 
      const group = groupMap.get(groupKey)
      group.subtotal += itemSubtotal
 
      const variantKey = `${variantName.toLowerCase()}__${price}`
 
      if (!group.variants.has(variantKey)) {
        group.variants.set(variantKey, {
          name: variantName,
          qty: 0,
          price,
          subtotal: 0,
        })
      }
 
      const variant = group.variants.get(variantKey)
      variant.qty += qty
      variant.subtotal += itemSubtotal
    })
 
  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    variants: Array.from(group.variants.values()),
  }))
}
 
function buildCurrentVersionedUrl(extraParams = {}) {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
 
  url.searchParams.set(VERSION_PARAM, APP_VERSION)
 
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      url.searchParams.delete(key)
    } else {
      url.searchParams.set(key, String(value))
    }
  })
 
  return url.toString()
}
 
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
 
export default function Page() {
  const { agent } = useParams()
  const productsGridRef = useRef(null)
  const bundleSectionRef = useRef(null)
  const bundleControlRef = useRef(null)
  const initRequestRef = useRef(0)
 
  const [products, setProducts] = useState([])
  const [bundles, setBundles] = useState([])
 
  const [cart, setCart] = useState([])
  const [bundleSelect, setBundleSelect] = useState({})
  const [selectedBundle, setSelectedBundle] = useState(null)
  const [selectedBundleFlavor, setSelectedBundleFlavor] = useState('')
 
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
 
  const [draftQty, setDraftQty] = useState({})
 
  const [selectedType, setSelectedType] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('')
  const [search, setSearch] = useState('')
 
  const [backupSelections, setBackupSelections] = useState({})
  const [noBackup, setNoBackup] = useState(false)
 
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedPreview, setCopiedPreview] = useState('')
 
  const [summaryCopied, setSummaryCopied] = useState(false)
const [showSummaryModal, setShowSummaryModal] = useState(false)

const DRAFT_STORAGE_KEY = `order2_draft_${String(agent || '').trim()}`
const [draftLoaded, setDraftLoaded] = useState(false)
 
  useEffect(() => {
    if (typeof window === 'undefined') return
 
    const url = new URL(window.location.href)
    const currentVersion = url.searchParams.get(VERSION_PARAM)
    const storedVersion = window.localStorage.getItem(VERSION_STORAGE_KEY)
    const reloadGuard = window.sessionStorage.getItem(VERSION_RELOAD_GUARD_KEY)
 
    const versionChanged = storedVersion !== APP_VERSION
    const urlMismatch = currentVersion !== APP_VERSION
 
    if (versionChanged) {
      window.localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION)
      window.sessionStorage.removeItem(VERSION_RELOAD_GUARD_KEY)
    }
 
    if ((versionChanged || urlMismatch) && reloadGuard !== APP_VERSION) {
      window.sessionStorage.setItem(VERSION_RELOAD_GUARD_KEY, APP_VERSION)
 
      const nextUrl = buildCurrentVersionedUrl()
      if (nextUrl && nextUrl !== window.location.href) {
        window.location.replace(nextUrl)
        return
      }
    }
 
    if (reloadGuard === APP_VERSION) {
      window.sessionStorage.removeItem(VERSION_RELOAD_GUARD_KEY)
    }
 
    // ✅ 只在第一次进入页面读取资料
    // ❌ 不再做 2 秒后自动 init，避免填写资料时被重刷
    // ❌ 不再监听 focus / visibilitychange，避免手机切去复制资料回来导致 cart 和表单被重刷
    init()
  }, [agent])
  useEffect(() => {
  if (typeof window === 'undefined') return

  const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY)

  if (!saved) {
    setDraftLoaded(true)
    return
  }

  try {
    const draft = JSON.parse(saved)

    setCart(Array.isArray(draft.cart) ? draft.cart : [])
    setDelivery(draft.delivery || '自取')
    setDate(draft.date || '')
    setTime(draft.time || '')
    setName(draft.name || '')
    setPhone(draft.phone || '')
    setAddress(draft.address || '')
    setState(draft.state || '')
    setPostcode(draft.postcode || '')
    setShipping(draft.shipping || '')
    setBackupSelections(draft.backupSelections || {})
    setNoBackup(Boolean(draft.noBackup))
  } catch (err) {
    console.error('LOAD DRAFT ERROR:', err)
  }

  setDraftLoaded(true)
}, [DRAFT_STORAGE_KEY])
useEffect(() => {
  if (typeof window === 'undefined') return
  if (!draftLoaded) return
  if (showSummaryModal) return

  const draft = {
    cart,
    delivery,
    date,
    time,
    name,
    phone,
    address,
    state,
    postcode,
    shipping,
    backupSelections,
    noBackup,
  }

  window.localStorage.setItem(
    DRAFT_STORAGE_KEY,
    JSON.stringify(draft)
  )
}, [
  DRAFT_STORAGE_KEY,
  draftLoaded,
  showSummaryModal,
  cart,
  delivery,
  date,
  time,
  name,
  phone,
  address,
  state,
  postcode,
  shipping,
  backupSelections,
  noBackup,
])
 
  async function init(options = {}) {
    const requestId = ++initRequestRef.current
 
    try {
      const rawAgent = String(agent || '').trim()
      const agentSlug = rawAgent.toLowerCase()
 
      if (!agentSlug) {
        if (requestId !== initRequestRef.current) return
        setAgentInfo(null)
        setProducts([])
        setBundles([])
        return
      }
 
      let foundAgent = null
      let foundAgentError = null
 
      for (let retry = 0; retry < 3 && !foundAgent; retry++) {
        console.log('FETCH AGENT TRY:', retry + 1)
 
        const { data: byAgentSlug, error: byAgentSlugError } = await supabase
          .from('agents')
          .select('*')
          .eq('agent_slug', agentSlug)
          .maybeSingle()
 
        if (byAgentSlugError) {
          console.error('AGENT BY AGENT_SLUG ERROR:', byAgentSlugError)
          foundAgentError = byAgentSlugError
        }
 
        if (byAgentSlug) {
          foundAgent = byAgentSlug
          break
        }
 
        const { data: bySlug, error: bySlugError } = await supabase
          .from('agents')
          .select('*')
          .eq('slug', agentSlug)
          .maybeSingle()
 
        if (bySlugError) {
          console.error('AGENT BY SLUG ERROR:', bySlugError)
          foundAgentError = bySlugError
        }
 
        if (bySlug) {
          foundAgent = bySlug
          break
        }
 
        const { data: byCode, error: byCodeError } = await supabase
          .from('agents')
          .select('*')
          .eq('code', rawAgent)
          .maybeSingle()
 
        if (byCodeError) {
          console.error('AGENT BY CODE ERROR:', byCodeError)
          foundAgentError = byCodeError
        }
 
        if (byCode) {
          foundAgent = byCode
          break
        }
 
        const agentId = Number(rawAgent)
 
        if (!Number.isNaN(agentId) && rawAgent !== '') {
          const { data: byId, error: byIdError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .maybeSingle()
 
          if (byIdError) {
            console.error('AGENT BY ID ERROR:', byIdError)
            foundAgentError = byIdError
          }
 
          if (byId) {
            foundAgent = byId
            break
          }
        }
 
        if (!foundAgent && retry < 2) {
          await sleep(500)
        }
      }
 
      console.log('APP VERSION:', APP_VERSION)
      console.log('AGENT PARAM:', agent)
      console.log('AGENT SLUG:', agentSlug)
      console.log('AGENT INFO:', foundAgent)
      console.log('AGENT ERROR:', foundAgentError)
 
      if (!foundAgent) {
        if (requestId !== initRequestRef.current) return
        setAgentInfo(null)
        setProducts([])
        setBundles([])
        setError('代理链接无效')
        return
      }
 
      let productsData = null
      let bundlesData = null
 
      for (let retry = 0; retry < 3 && !productsData; retry++) {
        const { data: p, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('brand', { ascending: true })
          .order('series', { ascending: true })
          .order('name', { ascending: true })
 
        if (productsError) {
          console.error('PRODUCTS ERROR:', productsError)
        }
 
        if (Array.isArray(p) && p.length > 0) {
          productsData = p
          break
        }
 
        if (Array.isArray(p) && p.length === 0) {
          productsData = []
          break
        }
 
        if (retry < 2) {
          await sleep(500)
        }
      }
 
      for (let retry = 0; retry < 3 && !bundlesData; retry++) {
        const { data: b, error: bundlesError } = await supabase
          .from('bundle_rules')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
 
        if (bundlesError) {
          console.error('BUNDLES ERROR:', bundlesError)
        }
 
        if (Array.isArray(b)) {
          bundlesData = b
          break
        }
 
        if (retry < 2) {
          await sleep(500)
        }
      }
 
      if (requestId !== initRequestRef.current) return
 
      setError('')
      setAgentInfo(foundAgent)
      setProducts(productsData || [])
      setBundles(bundlesData || [])
    } catch (err) {
      console.error('INIT ERROR:', err)
      if (requestId !== initRequestRef.current) return
      if (!options?.silent) {
        setError('读取代理资料失败')
      }
    }
  }
 
  useEffect(() => {
  if (!agentInfo) return

  const prefix = agentInfo.code || agentInfo.name || 'ORDER'
  const count = agentInfo.order_counter || 1

  setOrderId(`${prefix}-${String(count).padStart(4, '0')}`)

  // ❌ 不要清 cart / backup / 表单
  // setCart([])
  // setBackupSelections({})
  // setNoBackup(false)

  // ✅ 只清 bundle 相关
  setBundleSelect({})
  setSelectedBundle(null)
  setSelectedBundleFlavor('')
  setDraftQty({})
}, [agentInfo])
 
  function getAgentLevel() {
    const raw = String(agentInfo?.level ?? '').trim().toLowerCase()
    if (raw.includes('3')) return 3
    if (raw.includes('2')) return 2
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
 
    if (level === 3) return p3 || p2 || p1
    if (level === 2) return p2 || p1
    return p1
  }
 
  function getBundlePrice(bundle) {
    const level = getAgentLevel()
 
    const p1 = Number(bundle?.bundle_price_1 ?? 0)
    const p2 = Number(bundle?.bundle_price_2 ?? 0)
    const p3 = Number(bundle?.bundle_price_3 ?? 0)
 
    if (level === 3) return p3 || p2 || p1
    if (level === 2) return p2 || p1
    return p1
  }
 
  function getDraftQty(id) {
    return Number(draftQty[id] || 0)
  }
 
  function setDraftQtyValue(product, nextQty) {
    const maxStock = Number(product?.stock || 0)
    let qty = Number(nextQty || 0)
 
    if (Number.isNaN(qty) || qty < 0) qty = 0
    if (qty > maxStock) qty = maxStock
 
    setDraftQty((prev) => ({
      ...prev,
      [product.id]: qty,
    }))
  }
 
  function addDraftToCart(product) {
    const qty = Number(draftQty[product.id] || 0)
    const maxStock = Number(product?.stock || 0)
 
    if (qty <= 0) return
 
    const lockedPrice = getAgentPrice(product)
 
    setCart((prev) => {
      const found = prev.find(
        (i) => !i.is_bundle && String(i.id) === String(product.id)
      )
      const existingQty = Number(found?.qty || 0)
      const nextQty = existingQty + qty
 
      if (found) {
        const finalQty = nextQty > maxStock ? maxStock : nextQty
        return prev.map((i) =>
          !i.is_bundle && String(i.id) === String(product.id)
            ? { ...i, qty: finalQty, price: lockedPrice }
            : i
        )
      }
 
      return [
        ...prev,
        {
          ...product,
          qty: qty > maxStock ? maxStock : qty,
          price: lockedPrice,
          is_bundle: false,
        },
      ]
    })
 
    setDraftQty((prev) => ({
      ...prev,
      [product.id]: 0,
    }))
  }
 
  function addBundleToCart() {
    if (!selectedBundle) return
    if (bundleGroupCount <= 0) return
    if (bundleCount <= 0) return
 
    const selectedItems = Object.entries(bundleSelect)
      .map(([pid, qty]) => {
        const p = products.find((x) => String(x.id) === String(pid))
        if (!p || Number(qty || 0) <= 0) return null
 
        return {
          product_id: p.id,
          product_name: cleanProductName(p),
          brand: p.brand || '',
          series: p.series || '',
          qty: Number(qty || 0),
          stock: Number(p.stock || 0),
        }
      })
      .filter(Boolean)
 
    if (selectedItems.length === 0) return
 
    const bundleCartItem = {
      id: `bundle-${selectedBundle.id}-${Date.now()}`,
      is_bundle: true,
      bundle_rule_id: selectedBundle.id,
      bundle_name: selectedBundle.name,
      bundle_brand: selectedBundle.brand || '',
      qty: bundleGroupCount,
      price: bundleSinglePrice,
      bundle_items: selectedItems,
    }
 
    setCart((prev) => [...prev, bundleCartItem])
    setBundleSelect({})
    setSelectedBundleFlavor('')
  }
 
  function changeCartQty(id, nextQty) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.is_bundle) return i
          if (i.id !== id) return i
          let qty = Number(nextQty || 0)
          if (qty < 0) qty = 0
          if (qty > Number(i.stock || 0)) qty = Number(i.stock || 0)
          return { ...i, qty }
        })
        .filter((i) => (i.is_bundle ? true : i.qty > 0))
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
 
    const grouped = {}
 
    products
      .filter(
        (p) =>
          getProductType(p) === selectedType &&
          eqText(p.brand, selectedBrand) &&
          p.is_active !== false
      )
      .forEach((p) => {
        const name = cleanProductName(p)
        if (!name) return
 
        if (!grouped[name]) {
          grouped[name] = {
            name,
            inStock: false,
          }
        }
 
        if (Number(p.stock || 0) > 0) {
          grouped[name].inStock = true
        }
      })
 
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name))
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
      if (!eqText(p.brand, selectedBrand)) return false
      if (displayName !== selectedVariant) return false
      if (q && !joined.includes(q)) return false
      if (Number(p.stock || 0) <= 0) return false
      if (p.is_active === false) return false
 
      return true
    })
  }, [products, selectedType, selectedBrand, selectedVariant, search])
 
  useEffect(() => {
    if (!selectedVariant) return
    if (filteredProducts.length === 0) return
 
    const timer = setTimeout(() => {
      productsGridRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 120)
 
    return () => clearTimeout(timer)
  }, [selectedVariant, filteredProducts.length])
 
  const bundleProducts = useMemo(() => {
    if (!selectedBundle) return []
 
    const bundleBrand = normalizeText(selectedBundle.brand)
    if (!bundleBrand) return []
 
    return products.filter((p) => {
      if (p.is_active === false) return false
      if (Number(p.stock || 0) <= 0) return false
      return eqText(p.brand, bundleBrand)
    })
  }, [selectedBundle, products])
 
  const bundleFlavorOptions = useMemo(() => {
    return bundleProducts
      .map((p) => cleanProductName(p))
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
  }, [bundleProducts])
 
  const selectedBundleProduct = useMemo(() => {
    if (!selectedBundle || !selectedBundleFlavor) return null
    return (
      bundleProducts.find((p) => cleanProductName(p) === selectedBundleFlavor) ||
      null
    )
  }, [selectedBundle, selectedBundleFlavor, bundleProducts])
 
  const bundleSelectedItemsList = useMemo(() => {
    return Object.entries(bundleSelect)
      .map(([pid, qty]) => {
        const product = bundleProducts.find((p) => String(p.id) === String(pid))
        if (!product || Number(qty || 0) <= 0) return null
        return {
          id: product.id,
          name: cleanProductName(product),
          qty: Number(qty || 0),
          stock: Number(product.stock || 0),
          series: product.series || '',
          brand: product.brand || '',
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [bundleSelect, bundleProducts])
 
  useEffect(() => {
    if (!selectedBundle) return
    if (bundleFlavorOptions.length === 0) {
      setSelectedBundleFlavor('')
      return
    }
 
    if (
      selectedBundleFlavor &&
      bundleFlavorOptions.includes(selectedBundleFlavor)
    ) {
      return
    }
 
    setSelectedBundleFlavor(bundleFlavorOptions[0] || '')
  }, [selectedBundle, bundleFlavorOptions, selectedBundleFlavor])
 
  useEffect(() => {
    if (!selectedBundle) return
    if (!selectedBundleFlavor) return
 
    const timer = setTimeout(() => {
      bundleControlRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)
 
    return () => clearTimeout(timer)
  }, [selectedBundleFlavor])
 
  const bundleLimit = Number(selectedBundle?.min_select_qty || 0)
  const bundleBuyQty = Number(selectedBundle?.buy_qty || 0)
  const bundleFreeQty = Number(selectedBundle?.free_qty || 0)
  const bundleGroupSize =
    bundleBuyQty > 0 || bundleFreeQty > 0 ? bundleBuyQty + bundleFreeQty : 0
 
  const bundleCount = useMemo(() => {
    return Object.values(bundleSelect).reduce((s, v) => s + Number(v || 0), 0)
  }, [bundleSelect])
 
  const bundleGroupCount = useMemo(() => {
    if (bundleGroupSize > 0) {
      return Math.floor(bundleCount / bundleGroupSize)
    }
 
    if (bundleLimit > 0) {
      return Math.floor(bundleCount / bundleLimit)
    }
 
    return selectedBundle && bundleCount > 0 ? 1 : 0
  }, [bundleCount, bundleGroupSize, bundleLimit, selectedBundle])
 
  const bundleSinglePrice = useMemo(() => {
    return selectedBundle ? getBundlePrice(selectedBundle) : 0
  }, [selectedBundle, agentInfo])
 
  const draftBundleTotal = useMemo(() => {
    if (!selectedBundle) return 0
 
    if (bundleGroupSize > 0) {
      return bundleGroupCount * bundleSinglePrice
    }
 
    if (bundleLimit > 0) {
      return bundleGroupCount * bundleSinglePrice
    }
 
    return bundleCount > 0 ? bundleSinglePrice : 0
  }, [
    selectedBundle,
    bundleGroupSize,
    bundleGroupCount,
    bundleSinglePrice,
    bundleLimit,
    bundleCount,
  ])
 
  const bundleRequirementText = useMemo(() => {
    if (!selectedBundle) return ''
 
    if (bundleGroupSize > 0) {
      return `每组 ${bundleBuyQty}送${bundleFreeQty}，共 ${bundleGroupSize} 个`
    }
 
    if (bundleLimit > 0) {
      return `每组固定 ${bundleLimit} 个`
    }
 
    return ''
  }, [selectedBundle, bundleGroupSize, bundleBuyQty, bundleFreeQty, bundleLimit])
 
  const bundleRemaining = useMemo(() => {
    if (!selectedBundle || !bundleGroupSize || bundleCount <= 0) return 0
    const mod = bundleCount % bundleGroupSize
    if (mod === 0) return 0
    return bundleGroupSize - mod
  }, [selectedBundle, bundleGroupSize, bundleCount])
 
  function setBundleQty(pid, qty) {
    const currentMap = { ...bundleSelect }
    let next = Number(qty || 0)
 
    if (Number.isNaN(next) || next < 0) next = 0
 
    const targetProduct = bundleProducts.find(
      (p) => String(p.id) === String(pid)
    )
    const maxStock = Number(targetProduct?.stock || 0)
 
    if (next > maxStock) next = maxStock
 
    currentMap[pid] = next
    setBundleSelect(currentMap)
  }
 
  function changeBundleQty(pid, delta, maxStock) {
    const current = Number(bundleSelect[pid] || 0)
    let next = current + delta
    if (next < 0) next = 0
    if (next > Number(maxStock || 0)) next = Number(maxStock || 0)
    setBundleQty(pid, next)
  }
 
  const cartQty = useMemo(() => {
    return cart.reduce((s, i) => {
      if (i.is_bundle) {
        return s + Number(i.qty || 0)
      }
      return s + Number(i.qty || 0)
    }, 0)
  }, [cart])
 
  const region = useMemo(() => {
    if (!state) return '-'
    return EAST.includes((state || '').toUpperCase())
      ? 'East Malaysia'
      : 'West Malaysia'
  }, [state])
 
  const normalTotal = useMemo(() => {
    return cart
      .filter((i) => !i.is_bundle)
      .reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0)
  }, [cart])
 
  const bundleCartTotal = useMemo(() => {
    return cart
      .filter((i) => i.is_bundle)
      .reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0)
  }, [cart])
 
  const postageItemCount = useMemo(() => {
    return cart.reduce((s, i) => {
      if (i.is_bundle) {
        const bundleItemQty = (i.bundle_items || []).reduce(
          (sum, bi) => sum + Number(bi.qty || 0),
          0
        )
        return s + bundleItemQty
      }
 
      return s + Number(i.qty || 0)
    }, 0)
  }, [cart])
 
  const shippingFee = useMemo(() => {
    if (delivery === '邮寄') {
      if (postageItemCount > 19) return 'ASK'
      if (EAST.includes((state || '').toUpperCase())) return 28
      return 10
    }
    return Number(shipping || 0)
  }, [delivery, postageItemCount, state, shipping])
 
  const total = useMemo(() => {
    if (shippingFee === 'ASK') return normalTotal + bundleCartTotal
    return normalTotal + bundleCartTotal + Number(shippingFee || 0)
  }, [normalTotal, bundleCartTotal, shippingFee])
 
  const inStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock || 0) > 50).length
  }, [products])
 
  const lowStockCount = useMemo(() => {
    return products.filter(
      (p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 50
    ).length
  }, [products])
 
  const outStockCount = useMemo(() => {
    return products.filter((p) => Number(p.stock || 0) <= 0).length
  }, [products])
 
  const orderedBrands = useMemo(() => {
    const brands = new Set()
 
    cart.forEach((i) => {
      if (i.is_bundle) {
        const bundleBrand = normalizeText(i.bundle_brand)
        if (bundleBrand) brands.add(bundleBrand)
      } else {
        const brand = normalizeText(i.brand)
        if (brand) brands.add(brand)
      }
    })
 
    if (selectedBundle) {
      const bundleBrand = normalizeText(selectedBundle.brand)
      if (bundleBrand) brands.add(bundleBrand)
    }
 
    return Array.from(brands)
  }, [cart, selectedBundle])
 
  const backupOptions = useMemo(() => {
    const map = {}
 
    orderedBrands.forEach((brand) => {
      const list = products
        .filter((p) => eqText(p.brand, brand))
        .map((p) => cleanProductName(p))
        .filter(Boolean)
 
      map[brand] = [...new Set(list)]
    })
 
    return map
  }, [orderedBrands, products])
 
  const hasAnyBackupSelected = useMemo(() => {
    return Object.values(backupSelections).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    )
  }, [backupSelections])
 
  useEffect(() => {
    setBackupSelections((prev) => {
      const next = {}
 
      orderedBrands.forEach((brand) => {
        const validOptions = new Set(backupOptions[brand] || [])
        const kept = (prev[brand] || []).filter((item) => validOptions.has(item))
        if (kept.length > 0) {
          next[brand] = kept
        }
      })
 
      return next
    })
  }, [orderedBrands, backupOptions])
 
  useEffect(() => {
    if (orderedBrands.length === 0) {
      setBackupSelections({})
      setNoBackup(false)
    }
  }, [orderedBrands])
 
  function toggleNoBackup() {
    setNoBackup((prev) => {
      const next = !prev
      if (next) {
        setBackupSelections({})
      }
      return next
    })
  }
 
  function toggleBackup(brand, flavor) {
    setNoBackup(false)
 
    setBackupSelections((prev) => {
      const current = prev[brand] || []
 
      if (current.includes(flavor)) {
        const filtered = current.filter((f) => f !== flavor)
        const next = { ...prev }
 
        if (filtered.length > 0) {
          next[brand] = filtered
        } else {
          delete next[brand]
        }
 
        return next
      }
 
      return {
        ...prev,
        [brand]: [...current, flavor],
      }
    })
  }
 
  function resetFormAfterSubmit() {
  setCart([])
  setSelectedBundle(null)
  setSelectedBundleFlavor('')
  setBundleSelect({})
  setDate('')
  setTime('')
  setName('')
  setPhone('')
  setAddress('')
  setState('')
  setPostcode('')
  setShipping('')
  setDraftQty({})
  setBackupSelections({})
  setNoBackup(false)

  // ✅ 清除本地草稿（重点）
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  }
}
 
  function shippingText() {
    if (shippingFee === 'ASK') return '请问我查询运费'
    return `RM ${money(shippingFee)}`
  }
 
function buildCopiedSummary(oid) {
  const lines = []
  const itemTotal = normalTotal + bundleCartTotal
 
  lines.push('🧾 ORDER SUMMARY')
  lines.push('')

  // ✅ 配送信息
lines.push(`配送方式：${delivery}`)
lines.push(`订单编号：${oid}`)

if (delivery === '自取') {
  lines.push(`自取日期：${date || '-'}`)
  lines.push(`自取时间：${time || '-'}`)
}

if (delivery === '邮寄') {
  lines.push(`地区：${region}`)
  lines.push(`收件人：${name || '-'}`)
  lines.push(`电话：${phone || '-'}`)
  lines.push(`地址：${address || '-'}`)
  lines.push(`Postcode：${postcode || '-'}`)
  lines.push(`State：${state || '-'}`)
}

if (delivery === 'LALAMOVE') {
  lines.push(`收件人：${name || '-'}`)
  lines.push(`电话：${phone || '-'}`)
  lines.push(`地址：${address || '-'}`)
  lines.push(`Lalamove费用：RM${money(shipping || 0)}`)
}

lines.push('')
 
  lines.push('━━━━━━━━━━━━━━━')
lines.push('')
lines.push('订单内容')
 
  buildGroupedNormalItems(cart).forEach((group, gIndex) => {
  if (gIndex !== 0) {
    lines.push('')
  }
 
  lines.push(`【${group.name}】`)
 
  const priceMap = {}
 
  group.variants.forEach((variant) => {
    const priceKey = money(variant.price)
    if (!priceMap[priceKey]) priceMap[priceKey] = []
    priceMap[priceKey].push(variant)
  })
 
  Object.entries(priceMap).forEach(([price, variants]) => {
    lines.push(`💰 RM${price}`)
 
    variants.forEach((variant) => {
      lines.push(`• ${variant.name} ×${variant.qty}`)
    })
  })
 
  lines.push(`🧮 小计：RM${money(group.subtotal)}`)
})
 
  cart
    .filter((item) => item.is_bundle)
    .forEach((item) => {
      const subtotal = Number(item.qty || 0) * Number(item.price || 0)
 
      lines.push('')
      lines.push(`${item.bundle_name}（BUNDLE）× ${item.qty}组`)
      lines.push(`每组：RM${money(item.price)}`)
      lines.push(`小计：RM${money(subtotal)}`)
      lines.push(`口味明细`)
 
      ;(item.bundle_items || []).forEach((bi) => {
        const split = splitBrandFlavor(bi.brand, bi.product_name)
        if (split.brandLine) lines.push(split.brandLine)
        lines.push(`- ${split.flavorLine} × ${bi.qty}`)
      })
    })
 
  lines.push('')
  lines.push(`备注`)
 
  if (noBackup) {
    lines.push(`【不选择备选】`)
    lines.push(`如遇缺货，下一单扣`)
  } else {
    // ✅ 新增：先拿 cart 里面的 brand
const cartBrands = new Set(
  cart.map((item) =>
    normalizeText(item.is_bundle ? item.bundle_brand : item.brand)
  )
)
 
// ✅ 再过滤 backup，只保留购物车里的品牌
const backupEntries = Object.entries(backupSelections).filter(
  ([brand, flavors]) =>
    Array.isArray(flavors) &&
    flavors.length > 0 &&
    cartBrands.has(normalizeText(brand))
)
 
    if (backupEntries.length > 0) {
      lines.push(`【备选口味】`)
      lines.push('')
 
      backupEntries.forEach(([brand, flavors], index) => {
        lines.push(brand)
        flavors.forEach((f) => lines.push(`• ${f}`))
 
        if (index !== backupEntries.length - 1) {
          lines.push('')
        }
      })
    } else {
      lines.push(`-`)
    }
  }
 
  lines.push('')
  lines.push(`费用明细`)
  lines.push(`物品总额：RM${money(itemTotal)}`)
  lines.push(`运费：${shippingFee === 'ASK' ? '请问我查询运费' : `RM${money(shippingFee)}`}`)
  lines.push('')
  lines.push(`总额：RM${money(total)}`)
 
  return lines.join('\n')
}
 
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
 
  async function handleCopySummary() {
    try {
      await copyText(copiedPreview || '')
      setSummaryCopied(true)
    } catch (err) {
      console.error(err)
      alert('没有可复制的订单摘要')
    }
  }
 
  function hardRefreshPage() {
    if (typeof window === 'undefined') return
    window.location.replace(
      buildCurrentVersionedUrl({
        [REFRESH_PARAM]: Date.now(),
      })
    )
  }
 
  function handleCloseSummaryModal() {
  // ❗ 没复制 → 先确认
  if (!summaryCopied) {
    const ok = window.confirm('你还没复制订单摘要，确定要关闭吗？')
    if (!ok) return
  }

  // 关闭 modal
  setShowSummaryModal(false)

  // 已复制 → 才 refresh
  if (summaryCopied) {
    setTimeout(() => {
      hardRefreshPage()
    }, 300)
  }
}
 
  async function submit(e) {
    e.preventDefault()
 
    if (!agentInfo) {
      setError('代理链接无效')
      return
    }
 
    if (cart.length === 0) {
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
 
    if (orderedBrands.length > 0 && !noBackup && !hasAnyBackupSelected) {
      setError('请选择备选口味，或勾选【不选择备选】')
      return
    }
 try {
  setSubmitting(true)
  setError('')
  setSuccess('')
  setSummaryCopied(false)
  setShowSummaryModal(false)
   console.log('SUBMIT agent_id:', agentInfo.id, typeof agentInfo.id)

const prefix = agentInfo.code || agentInfo.name || 'ORDER'

const { data: oid, error: orderIdError } = await supabase.rpc(
  'create_agent_order_id',
  {
    agent_id_input: Number(agentInfo.id), // ✅ 这里一定要 Number
  }
)

if (orderIdError) throw orderIdError
console.log('FINAL agent_id:', agentInfo.id, typeof agentInfo.id)
console.log('OID:', oid)
 
      const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
   agent_id: Number(agentInfo.id),
    agent_name: prefix,
    delivery_method: delivery,
    pickup_order_id: String(oid),
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
        if (i.is_bundle) {
          ;(i.bundle_items || []).forEach((bi) => {
            items.push({
              order_id: order.id,
              product_id: bi.product_id,
              product_name: bi.product_name,
              qty: Number(bi.qty || 0),
              unit_price: 0,
              subtotal: 0,
              item_type: 'BUNDLE_ITEM',
              bundle_rule_id: i.bundle_rule_id,
              bundle_name: i.bundle_name,
            })
          })
        } else {
          items.push({
            order_id: order.id,
            product_id: i.id,
            product_name: cleanProductName(i),
            qty: i.qty,
            unit_price: i.price,
            subtotal: Number(i.qty || 0) * Number(i.price || 0),
            item_type: 'NORMAL',
          })
        }
      })
 
      const { error: itemError } = await supabase.from('order_items').insert(items)
      if (itemError) throw itemError
 
      for (const i of cart) {
  if (i.is_bundle) {
    for (const bi of i.bundle_items || []) {
      const { error: bundleStockError } = await supabase.rpc(
        'decrement_stock',
        {
          product_id_input: bi.product_id,
          qty_input: Number(bi.qty || 0),
        }
      )

      if (bundleStockError) throw bundleStockError
    }
  } else {
    const { error: stockError } = await supabase.rpc(
      'decrement_stock',
      {
        product_id_input: i.id,
        qty_input: Number(i.qty || 0),
      }
    )

    if (stockError) throw stockError
  }
}
 
      const copiedSummary = buildCopiedSummary(oid)
      setCopiedPreview(copiedSummary)
      setShowSummaryModal(true)
      setSummaryCopied(false)
      setSuccess(`成功：${oid}`)
 
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
        <div className="mb-3 flex items-center justify-between gap-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7b63]">
          <span>Version</span>
          <span>{APP_VERSION}</span>
        </div>
 
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
                  {agentInfo?.name || agentInfo?.code || '欢迎下单'}
                </h1>
 
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  <div>agent param: {String(agent || '-')}</div>
                  <div>agentInfo: {agentInfo ? (agentInfo.name || agentInfo.code || 'YES') : 'NO'}</div>
                  <div>products: {products.length}</div>
                  <div>bundles: {bundles.length}</div>
                  <div>error: {error || '-'}</div>
                </div>
 
                <p className="mt-2 text-sm text-[#9b7b63]">
                  欢迎来到下单系统，看来今天又要发大财了❤️
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
                      {variantOptions.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          disabled={!item.inStock}
                          onClick={() => {
                            if (!item.inStock) return
                            setSelectedVariant(item.name)
                          }}
                          className={`rounded-3xl border px-4 py-2 text-sm font-semibold transition ${
                            selectedVariant === item.name && item.inStock
                              ? 'border-[#cba98a] bg-[#dcc0a8] text-white shadow-sm'
                              : item.inStock
                                ? 'border-[#eadacb] bg-[#fffaf6] text-[#7a5b47] hover:bg-[#f8efe6]'
                                : 'border-red-200 bg-red-50 text-[#b3a395] cursor-not-allowed'
                          }`}
                        >
                          <span>{item.name}</span>
                          {!item.inStock ? (
                            <span className="ml-2 text-[11px] font-black uppercase tracking-wide text-red-500">
                              OUT OF STOCK
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
 
              <div
                ref={productsGridRef}
                className="mt-5 mb-4 rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-sm text-[#a08874]"
              >
                {selectedVariant
                  ? filteredProducts.length > 0
                    ? `Showing ${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`
                    : 'This option is out of stock'
                  : `请选择${currentVariantLabel}后显示产品`}
              </div>
 
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((p) => {
                  const stockInfo = stockLabel(p.stock)
                  const displayPrice = getAgentPrice(p)
                  const displayName = cleanProductName(p)
                  const qtyDraft = getDraftQty(p.id)
 
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
                          <div className="mt-2 line-clamp-2 text-sm md:text-base font-bold text-[#5f4432] leading-tight">
                            {displayName}
                          </div>
                          <div className="mt-1 text-xs text-[#a88b77]">
                            {p.series || '-'} · {getVariantLabel(p)}
                          </div>
                        </div>
 
                        <div className={`mt-3 inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${stockInfo.badge}`}>
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
 
                      <div className="mt-4 rounded-[24px] border border-[#eadacb] bg-[#fffaf6] p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#b0947f]">
                          Quantity
                        </div>
 
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDraftQtyValue(p, qtyDraft - 1)}
                            disabled={qtyDraft <= 0}
                            className="h-12 w-12 rounded-3xl border border-[#eadacb] bg-white text-lg font-bold text-[#6c513d] transition hover:bg-[#f8efe6] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            -
                          </button>
 
                          <input
                            type="number"
                            min="0"
                            max={Number(p.stock || 0)}
                            value={qtyDraft}
                            onChange={(e) => setDraftQtyValue(p, e.target.value)}
                            className="h-12 flex-1 rounded-3xl border border-[#eadacb] bg-white px-3 text-center text-base font-bold text-[#5c4333] outline-none focus:border-[#cfae95]"
                          />
 
                          <button
                            type="button"
                            onClick={() => setDraftQtyValue(p, qtyDraft + 1)}
                            disabled={Number(p.stock || 0) <= 0 || qtyDraft >= Number(p.stock || 0)}
                            className="h-12 w-12 rounded-3xl border border-[#eadacb] bg-white text-lg font-bold text-[#6c513d] transition hover:bg-[#f8efe6] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
 
                        <div className="mt-2 text-center text-xs text-[#8b7260]">
                          {qtyDraft > 0 ? `准备加入 ${qtyDraft} 个` : '先选择数量，再加入购物车'}
                        </div>
                      </div>
 
                      <button
                        type="button"
                        onClick={() => addDraftToCart(p)}
                        disabled={
                          Number(p.stock || 0) <= 0 ||
                          Number(displayPrice) <= 0 ||
                          Number(qtyDraft || 0) <= 0
                        }
                        className="mt-3 w-full rounded-3xl border border-[#16a34a] bg-[#22c55e] px-4 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-[#16a34a] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Add to Cart 🛒
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
 
            <section
              ref={bundleSectionRef}
              className="rounded-[30px] border border-[#eadacb] bg-white/80 p-5 shadow-[0_15px_45px_rgba(121,88,63,0.10)] backdrop-blur"
            >
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
                      setSelectedBundleFlavor('')
                      setTimeout(() => {
                        bundleSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }, 120)
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
                  <div className="rounded-3xl border border-[#eadacb] bg-[#fbf6f1] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-[#8c654a]">
                          Bundle Price Per Group:{' '}
                          <span className="font-bold">RM {money(bundleSinglePrice)}</span>
                        </div>
 
                        {bundleRequirementText ? (
                          <div className="mt-1 text-sm text-[#a18673]">
                            规则：
                            <span className="font-bold text-[#5f4432]">
                              {' '}
                              {bundleRequirementText}
                            </span>
                          </div>
                        ) : null}
 
                        <div className="mt-2 text-sm text-[#a18673]">
                          已选：
                          <span className="font-bold text-[#5f4432]"> {bundleCount} </span>盒
                        </div>
 
                        <div className="mt-1 text-sm text-[#a18673]">
                          已完成：
                          <span className="font-bold text-[#5f4432]"> {bundleGroupCount} </span>组
                        </div>
 
                        {bundleRemaining > 0 ? (
                          <div className="mt-1 text-sm font-semibold text-red-500">
                            还差 {bundleRemaining} 盒
                          </div>
                        ) : bundleCount > 0 ? (
                          <div className="mt-1 text-sm font-semibold text-green-600">
                            已满足 Bundle 条件
                          </div>
                        ) : null}
 
                        <div className="mt-1 text-sm text-[#a18673]">
                          Draft Bundle Total:{' '}
                          <span className="font-bold text-[#5f4432]">
                            RM {money(draftBundleTotal)}
                          </span>
                        </div>
 
                        <div className="mt-1 text-xs text-[#a18673]">
                          Bind Brand:{' '}
                          <span className="font-bold text-[#5f4432]">
                            {selectedBundle.brand || '-'}
                          </span>
                        </div>
 
                        {bundleGroupSize > 0 ? (
                          <div className="mt-2 text-xs text-[#8a6d59]">
                            例子：{bundleGroupSize} / {bundleGroupSize * 2} /{' '}
                            {bundleGroupSize * 3}
                          </div>
                        ) : bundleLimit > 0 ? (
                          <div className="mt-2 text-xs text-[#8a6d59]">
                            例子：{bundleLimit} / {bundleLimit * 2} / {bundleLimit * 3}
                          </div>
                        ) : null}
                      </div>
 
                      <button
                        type="button"
                        onClick={() => {
                          setBundleSelect({})
                          setSelectedBundleFlavor(bundleFlavorOptions[0] || '')
                        }}
                        className="rounded-3xl border border-[#eadacb] bg-white px-4 py-2 text-sm text-[#7a5b47] hover:bg-[#f8efe6]"
                      >
                        Clear Bundle
                      </button>
                    </div>
 
                    <button
                      type="button"
                      onClick={addBundleToCart}
                      disabled={bundleGroupCount <= 0}
                      className="mt-4 w-full rounded-3xl border border-[#16a34a] bg-[#22c55e] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Add Bundle to Cart 🛒
                    </button>
                  </div>
 
                  {bundleProducts.length === 0 ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
                      这个 Bundle 目前没有匹配到产品。请检查{' '}
                      <strong>bundle_rules.brand</strong> 是否和{' '}
                      <strong>products.brand</strong> 完全对应。
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[#a88b77]">
                          口味选择
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {bundleFlavorOptions.map((flavor) => (
                            <FilterButton
                              key={flavor}
                              active={selectedBundleFlavor === flavor}
                              onClick={() => setSelectedBundleFlavor(flavor)}
                            >
                              {flavor}
                            </FilterButton>
                          ))}
                        </div>
                      </div>
 
                      <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3 text-sm text-[#a08874]">
                        {selectedBundleFlavor
                          ? `Showing 1 product`
                          : `请选择口味后显示产品`}
                      </div>
 
                      {selectedBundleProduct ? (
                        <div
                          ref={bundleControlRef}
                          className="rounded-[26px] border border-[#eadacb] bg-[linear-gradient(180deg,#fffdfb_0%,#fcf6f0_100%)] p-4"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b0947f]">
                              {getProductType(selectedBundleProduct)} ·{' '}
                              {selectedBundleProduct.brand || 'NO BRAND'}
                            </div>
 
                            <div className="mt-2 text-sm md:text-base font-bold text-[#5f4432] leading-tight">
                              {cleanProductName(selectedBundleProduct)}
                            </div>
 
                            <div className="mt-1 text-xs text-[#a88b77]">
                              {selectedBundleProduct.series || '-'} ·{' '}
                              {getVariantLabel(selectedBundleProduct)}
                            </div>
 
                            <div
                              className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${stockLabel(selectedBundleProduct.stock).badge}`}
                            >
                              {stockLabel(selectedBundleProduct.stock).text}
                            </div>
                          </div>
 
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] p-3">
                              <div className="text-[11px] font-semibold uppercase tracking-widest text-[#b0947f]">
                                Stock
                              </div>
                              <div className="mt-2 text-xl font-black text-[#5f4432]">
                                {Number(selectedBundleProduct.stock || 0)}
                              </div>
                            </div>
 
                            <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] p-3">
                              <div className="text-[11px] font-semibold uppercase tracking-widest text-[#b0947f]">
                                Selected
                              </div>
                              <div className="mt-2 text-xl font-black text-[#7b5740]">
                                {Number(bundleSelect[selectedBundleProduct.id] || 0)}
                              </div>
                            </div>
                          </div>
 
                          <div className="mt-4 rounded-[24px] border border-[#eadacb] bg-[#fffaf6] p-3">
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#b0947f]">
                              Quantity
                            </div>
 
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  changeBundleQty(
                                    selectedBundleProduct.id,
                                    -1,
                                    selectedBundleProduct.stock
                                  )
                                }
                                disabled={
                                  Number(bundleSelect[selectedBundleProduct.id] || 0) <= 0
                                }
                                className="h-12 w-12 rounded-3xl border border-[#eadacb] bg-white text-lg font-bold text-[#6c513d] transition hover:bg-[#f8efe6] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                -
                              </button>
 
                              <input
                                type="number"
                                min="0"
                                max={Number(selectedBundleProduct.stock || 0)}
                                value={bundleSelect[selectedBundleProduct.id] || 0}
                                onChange={(e) =>
                                  setBundleQty(selectedBundleProduct.id, e.target.value)
                                }
                                className="h-12 flex-1 rounded-3xl border border-[#eadacb] bg-white px-3 text-center text-base font-bold text-[#5c4333] outline-none focus:border-[#cfae95]"
                              />
 
                              <button
                                type="button"
                                onClick={() =>
                                  changeBundleQty(
                                    selectedBundleProduct.id,
                                    1,
                                    selectedBundleProduct.stock
                                  )
                                }
                                disabled={
                                  Number(bundleSelect[selectedBundleProduct.id] || 0) >=
                                  Number(selectedBundleProduct.stock || 0)
                                }
                                className="h-12 w-12 rounded-3xl border border-[#eadacb] bg-white text-lg font-bold text-[#6c513d] transition hover:bg-[#f8efe6] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
 
                            <div className="mt-2 text-center text-xs text-[#8b7260]">
                              {Number(bundleSelect[selectedBundleProduct.id] || 0) > 0
                                ? `当前已选 ${Number(bundleSelect[selectedBundleProduct.id] || 0)} 盒`
                                : '先选择数量，再继续选择其他口味'}
                            </div>
                          </div>
                        </div>
                      ) : null}
 
                      <div className="rounded-[26px] border border-[#eadacb] bg-[linear-gradient(180deg,#fffdfb_0%,#fcf6f0_100%)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base font-black text-[#5f4432]">
                            Bundle 已选清单
                          </div>
                          <div className="text-sm text-[#8a6d59]">
                            {bundleCount} /{' '}
                            {bundleGroupSize > 0
                              ? `${bundleGroupSize} 每组`
                              : bundleLimit > 0
                                ? `${bundleLimit} 每组`
                                : '已选'}
                          </div>
                        </div>
 
                        {bundleSelectedItemsList.length === 0 ? (
                          <div className="mt-3 rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-4 text-sm text-[#a08874]">
                            还没有选择 bundle 口味
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {bundleSelectedItemsList.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3"
                              >
                                <div className="min-w-0 pr-3">
                                  <div className="truncate text-sm font-bold text-[#5f4432]">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-[#a88b77]">
                                    {item.brand} {item.series ? `· ${item.series}` : ''}
                                  </div>
                                </div>
 
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => changeBundleQty(item.id, -1, item.stock)}
                                    className="h-9 w-9 rounded-full border border-[#eadacb] bg-white text-[#6c513d] hover:bg-[#f8efe6]"
                                  >
                                    -
                                  </button>
 
                                  <div className="min-w-[28px] text-center text-sm font-bold text-[#5f4432]">
                                    {item.qty}
                                  </div>
 
                                  <button
                                    type="button"
                                    onClick={() => changeBundleQty(item.id, 1, item.stock)}
                                    className="h-9 w-9 rounded-full border border-[#eadacb] bg-white text-[#6c513d] hover:bg-[#f8efe6]"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
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
                  {cart.map((item) =>
                    item.is_bundle ? (
                      <div
                        key={item.id}
                        className="rounded-[26px] border border-[#d6f0d8] bg-[linear-gradient(180deg,#fafffb_0%,#f1fbf2_100%)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5d8a60]">
                              BUNDLE · {item.bundle_brand || 'NO BRAND'}
                            </div>
                            <div className="mt-2 text-base font-bold text-[#24502b]">
                              {item.bundle_name}
                            </div>
                            <div className="mt-2 text-sm text-[#3f6a45]">
                              {item.qty} 组 × RM {money(item.price)}
                            </div>
                          </div>
 
                          <button
                            type="button"
                            onClick={() => removeCart(item.id)}
                            className="rounded-3xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-500 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
 
                        <div className="mt-3 rounded-3xl border border-[#d8ead9] bg-white/80 p-3">
                          <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#6d8d70]">
                            Bundle Items
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-[#446148]">
                            {(item.bundle_items || []).map((bi, idx) => (
                              <div key={`${item.id}-${bi.product_id}-${idx}`}>
                                {bi.product_name} - {bi.qty}
                              </div>
                            ))}
                          </div>
                        </div>
 
                        <div className="mt-3 text-right text-sm font-bold text-[#24502b]">
                          Subtotal: RM {money(Number(item.qty || 0) * Number(item.price || 0))}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.id}
                        className="rounded-[26px] border border-[#eadacb] bg-[linear-gradient(180deg,#fffdfb_0%,#fcf6f0_100%)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b0947f]">
                              {getProductType(item)} · {item.brand || 'NO BRAND'} {item.series ? `• ${item.series}` : ''}
                            </div>
                            <div className="mt-2 text-base font-bold text-[#5f4432]">
                              {cleanProductName(item)}
                            </div>
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
                    )
                  )}
                </div>
              )}
            </section>
 
            <section className="rounded-[30px] border border-[#eadacb] bg-white/80 p-5 shadow-[0_15px_45px_rgba(121,88,63,0.10)] backdrop-blur">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#b08867]">
                  <PawPrint />
                  Backup
                </div>
                <h2 className="mt-2 text-xl font-black text-[#5f4432]">备选口味/颜色</h2>
              </div>
 
              {orderedBrands.length === 0 ? (
                <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-4 text-sm text-[#a08874]">
                  下单后才会出现备选选项
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500">
                    此项必选：请勾选【不选择备选】或选择至少一个备选口味
                  </div>
 
                  <div className="rounded-3xl border border-[#eadacb] bg-[#fffaf6] p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={noBackup}
                        onChange={toggleNoBackup}
                        className="h-4 w-4"
                      />
                      <span className="font-semibold text-[#5f4432]">不选择备选</span>
                    </label>
 
                    <div className="mt-2 text-sm text-[#8a6d59]">
                      勾选后将自动备注：下一单扣
                    </div>
                  </div>
 
                  {orderedBrands.map((brand) => (
                    <div
                      key={brand}
                      className="rounded-[26px] border border-[#eadacb] bg-[linear-gradient(180deg,#fffdfb_0%,#fcf6f0_100%)] p-4"
                    >
                      <div className="mb-3 text-base font-black text-[#5f4432]">
                        {brand}
                      </div>
 
                      <div className="flex flex-wrap gap-2">
                        {(backupOptions[brand] || []).map((flavor) => {
                          const active = backupSelections[brand]?.includes(flavor)
 
                          return (
                            <button
                              key={flavor}
                              type="button"
                              disabled={noBackup}
                              onClick={() => toggleBackup(brand, flavor)}
                              className={`rounded-3xl border px-4 py-2 text-sm font-semibold transition ${
                                active
                                  ? 'border-[#cba98a] bg-[#dcc0a8] text-white shadow-sm'
                                  : 'border-[#eadacb] bg-[#fffaf6] text-[#7a5b47] hover:bg-[#f8efe6]'
                              } ${noBackup ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              {flavor}
                            </button>
                          )
                        })}
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
                  <span className="font-bold text-[#5f4432]">
                    RM {money(bundleCartTotal)}
                  </span>
                </div>
 
                <div className="flex items-center justify-between rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3">
                  <span className="text-[#8b7260]">Shipping</span>
                  <span className="font-bold text-[#5f4432]">{shippingText()}</span>
                </div>
 
                <div className="flex items-center justify-between rounded-3xl border border-[#eadacb] bg-[#fffaf6] px-4 py-3">
                  <span className="text-[#8b7260]">Backup Status</span>
                  <span className="font-bold text-[#5f4432]">
                    {noBackup
                      ? '不选择备选'
                      : hasAnyBackupSelected
                        ? '已选择备选'
                        : '未完成'}
                  </span>
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
            </section>
          </div>
        </form>{cart.length > 0 && !showSummaryModal && (
  <div className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-[#eadacb] bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(121,88,63,0.15)] backdrop-blur md:hidden">
    <div className="mx-auto flex max-w-7xl items-center gap-3">
      <div className="flex-1">
        <div className="text-xs font-semibold text-[#9b7b63]">
          🛒 {cartQty} items
        </div>
        <div className="text-lg font-black text-[#5f4432]">
          RM {money(total)}
        </div>
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          document.querySelector('form')?.requestSubmit()
        }}
        className="rounded-3xl border border-[#d2b49c] bg-[#dcc0a8] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
      >
        {submitting ? '提交中' : '提交订单'}
      </button>
    </div>
  </div>
)}
      </div>
 
      {showSummaryModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          onClick={handleCloseSummaryModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-[28px] border border-[#eadacb] bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-[#5f4432]">
                ORDER SUMMARY
              </h3>
 
              <button
                type="button"
                onClick={handleCloseSummaryModal}
                className="rounded-full border border-[#eadacb] px-3 py-1 text-xs text-[#7a5b47] hover:bg-[#f8efe6]"
              >
                关闭
              </button>
            </div>
 
            <textarea
              value={copiedPreview}
              readOnly
              className="min-h-[280px] w-full rounded-3xl border border-[#b6e07b] bg-[#97e067] px-4 py-3 text-sm text-[#17320d] outline-none"
            />
 
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[#7a5b47]">
                {summaryCopied ? '已复制，可关闭视窗' : '请先复制订单摘要'}
              </div>
 
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className={`rounded-3xl border px-4 py-2 text-sm font-bold transition ${
                    summaryCopied
                      ? 'border-green-200 bg-green-50 text-green-600'
                      : 'border-[#d2b49c] bg-[#dcc0a8] text-white hover:bg-[#cfaf93]'
                  }`}
                >
                  {summaryCopied ? '已复制' : '复制'}
                </button>
 
                <button
                  type="button"
                  onClick={handleCloseSummaryModal}
                  className="rounded-3xl border border-[#eadacb] bg-white px-4 py-2 text-sm font-bold text-[#7a5b47] hover:bg-[#f8efe6]"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
