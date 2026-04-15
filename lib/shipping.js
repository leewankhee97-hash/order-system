export function getZone(stateValue) {
  const east = ['Sabah', 'Sarawak', 'Labuan']
  return east.includes(stateValue) ? '东马' : '西马'
}

export function getDeliveryText(deliveryType) {
  if (deliveryType === 'SELF_PICKUP') return '代理自取'
  if (deliveryType === 'LALAMOVE') return 'Lalamove'
  return '邮寄'
}

export function getShippingInfo(deliveryType, stateName, totalQty) {
  if (deliveryType === 'SELF_PICKUP') {
    return {
      zone: '',
      shippingFee: 0,
      shippingText: '',
      isAskShipping: false,
    }
  }

  if (deliveryType === 'LALAMOVE') {
    return {
      zone: '',
      shippingFee: 0,
      shippingText: '自己查询了填写下去',
      isAskShipping: true,
    }
  }

  const zone = stateName ? getZone(stateName) : ''

  if (!zone) {
    return {
      zone: '',
      shippingFee: 0,
      shippingText: '-',
      isAskShipping: false,
    }
  }

  const shippingRules = {
    西马: { maxQty: 6, fee: 8 },
    东马: { maxQty: 4, fee: 15 },
  }

  const rule = shippingRules[zone]

  if (totalQty === 0) {
    return {
      zone,
      shippingFee: 0,
      shippingText: '-',
      isAskShipping: false,
    }
  }

  if (totalQty <= rule.maxQty) {
    return {
      zone,
      shippingFee: rule.fee,
      shippingText: `RM${rule.fee}`,
      isAskShipping: false,
    }
  }

  return {
    zone,
    shippingFee: 0,
    shippingText: '请告知我运费',
    isAskShipping: true,
  }
}