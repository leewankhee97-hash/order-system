export function getSeriesPrice(product, seriesPrices, selectedAgent) {
  const row = seriesPrices.find((p) => p.series_name === product.SERIES)

  if (!row) return 0
  if (!selectedAgent?.level) return Number(row.level_3_price || 0)

  const level = Number(selectedAgent.level)

  if (level === 1) return Number(row.level_1_price || 0)
  if (level === 2) return Number(row.level_2_price || 0)
  return Number(row.level_3_price || 0)
}