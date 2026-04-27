import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const body = await req.json()
    const agentId = body.agent_id

    if (!agentId) {
      return new Response('Missing agent_id', { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, code, slug')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return new Response('Agent not found', { status: 404 })
    }

    const { data: orders, error: orderSelectError } = await supabase
      .from('orders')
      .select('id')
      .eq('agent_id', agent.id)

    if (orderSelectError) {
      return new Response(orderSelectError.message, { status: 500 })
    }

    const orderIds = (orders || []).map((o) => o.id)

    if (orderIds.length > 0) {
      const { error: itemDeleteError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds)

      if (itemDeleteError) {
        return new Response(itemDeleteError.message, { status: 500 })
      }
    }

    const { error: orderDeleteError } = await supabase
      .from('orders')
      .delete()
      .eq('agent_id', agent.id)

    if (orderDeleteError) {
      return new Response(orderDeleteError.message, { status: 500 })
    }

    const { error: resetError } = await supabase
      .from('agents')
      .update({ order_counter: 1 })
      .eq('id', agent.id)

    if (resetError) {
      return new Response(resetError.message, { status: 500 })
    }

    return new Response('OK')
  } catch (err) {
    return new Response(err?.message || 'Reset failed', { status: 500 })
  }
}