import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { agent_id } = await req.json()

    if (!agent_id) {
      return new Response('Missing agent_id', { status: 400 })
    }

    // ✅ 这里要确保 key 存在
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return new Response('Missing Supabase ENV', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 找 agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return new Response('Agent not found', { status: 404 })
    }

    // 找 orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('agent_id', agent.id)

    const orderIds = (orders || []).map((o) => o.id)

    if (orderIds.length > 0) {
      await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds)
    }

    await supabase
      .from('orders')
      .delete()
      .eq('agent_id', agent.id)

    await supabase
      .from('agents')
      .update({ order_counter: 1 })
      .eq('id', agent.id)

    return new Response('OK')
  } catch (err) {
    return new Response(err.message || 'Error', { status: 500 })
  }
}