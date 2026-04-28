import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { agent_id } = await req.json()

    if (!agent_id) {
      return new Response('Missing agent_id', { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return new Response('Missing Supabase ENV', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 1. 找 agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return new Response('Agent not found', { status: 404 })
    }

    // 2. 找该 agent 的 orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('agent_id', agent.id)

    if (ordersError) {
      return new Response(ordersError.message, { status: 500 })
    }

    const orderIds = (orders || []).map((o) => o.id)

    // 没订单也重置 counter
    if (orderIds.length === 0) {
      await supabase
        .from('agents')
        .update({ order_counter: 1 })
        .eq('id', agent.id)

      return new Response('OK')
    }

    // 3. 找 order_items，用来恢复库存
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, qty')
      .in('order_id', orderIds)

    if (itemsError) {
      return new Response(itemsError.message, { status: 500 })
    }

    // 4. 汇总每个 product 要加回多少库存
    const restoreMap = {}

    ;(orderItems || []).forEach((item) => {
      if (!item.product_id) return

      const productId = String(item.product_id)
      const qty = Number(item.qty || 0)

      if (!restoreMap[productId]) {
        restoreMap[productId] = 0
      }

      restoreMap[productId] += qty
    })

    // 5. 逐个产品恢复库存
    for (const [productId, qtyToRestore] of Object.entries(restoreMap)) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single()

      if (productError || !product) {
        continue
      }

      const currentStock = Number(product.stock || 0)
      const newStock = currentStock + qtyToRestore

      const { error: updateStockError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId)

      if (updateStockError) {
        return new Response(updateStockError.message, { status: 500 })
      }
    }

    // 6. 删除 order_items
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .in('order_id', orderIds)

    if (deleteItemsError) {
      return new Response(deleteItemsError.message, { status: 500 })
    }

    // 7. 删除 orders
    const { error: deleteOrdersError } = await supabase
      .from('orders')
      .delete()
      .eq('agent_id', agent.id)

    if (deleteOrdersError) {
      return new Response(deleteOrdersError.message, { status: 500 })
    }

    // 8. 重置 order_counter
    const { error: resetCounterError } = await supabase
      .from('agents')
      .update({ order_counter: 1 })
      .eq('id', agent.id)

    if (resetCounterError) {
      return new Response(resetCounterError.message, { status: 500 })
    }

    return new Response('OK')
  } catch (err) {
    return new Response(err?.message || 'Reset failed', { status: 500 })
  }
}