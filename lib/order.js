export function buildOrderText({
  selectedAgent,
  deliveryType,
  deliveryText,
  zone,
  shippingFee,
  shippingText,
  isAskShipping,
  receiverName,
  receiverPhone,
  receiverAddress,
  postcode,
  stateName,
  selectedProducts,
  qtyMap,
  orderId,
}) {
  const grouped = {}
  let subtotal = 0

  selectedProducts.forEach((product) => {
    const qty = qtyMap[product.ID] || 0
    const key = `${product.SERIES}_${product.DISPLAY_PRICE}`

    if (!grouped[key]) {
      grouped[key] = {
        series: product.SERIES,
        price: product.DISPLAY_PRICE,
        totalQty: 0,
        items: [],
      }
    }

    grouped[key].items.push({
      name: product.NAME,
      qty,
    })
    grouped[key].totalQty += qty
  })

  let text = `==============================
ORDER SUMMARY
==============================

${orderId ? `ORDER ID：${orderId}\n` : ''}代理：${selectedAgent ? selectedAgent.agent_name : '-'}
等级：${selectedAgent ? `${selectedAgent.level} 级代理` : '-'}
配送方式：${deliveryText}
`

  if (deliveryType === 'POSTAGE') {
    text += `地区：${zone}
运费：${shippingText}
`
  }

  if (deliveryType === 'LALAMOVE') {
    text += `运费：${shippingText}
`
  }

  text += `
`

  if (deliveryType !== 'SELF_PICKUP') {
    text += `收件人名字：${receiverName}
电话：${receiverPhone}
`
  }

  if (deliveryType === 'POSTAGE') {
    text += `地址：${receiverAddress}
Postcode：${postcode}
州属：${stateName}

`
  }

  if (deliveryType === 'LALAMOVE') {
    text += `地址：${receiverAddress}

`
  }

  text += `--------------------------------
`

  Object.values(grouped).forEach((group) => {
    const groupTotal = group.totalQty * group.price
    subtotal += groupTotal

    text += `${group.series} (RM${group.price})
`
    group.items.forEach((item) => {
      text += `${item.name}-${item.qty}
`
    })
    text += `[TOTAL ${group.totalQty}*RM${group.price}=RM${groupTotal}]

`
  })

  text += `--------------------------------
`

  if (deliveryType === 'SELF_PICKUP') {
    text += `货品总额：RM${subtotal}
总数：RM${subtotal}

==============================`
  } else if (isAskShipping) {
    text += `货品总额：RM${subtotal}
运费：${shippingText}
总数：请告知我总数

==============================`
  } else {
    text += `货品总额：RM${subtotal}
邮费：RM${shippingFee}
总数：RM${subtotal + shippingFee}

==============================`
  }

  return text
}