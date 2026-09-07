const toSafeNumber = (value) => Number(value) || 0

export function getTotalInvestment(bale) {
  return (
    toSafeNumber(bale.purchaseCost) +
    toSafeNumber(bale.acquisitionTransport) +
    toSafeNumber(bale.otherExpenses)
  )
}

export function getSellablePieces(bale) {
  return Math.max(0, toSafeNumber(bale.receivedPieces) - toSafeNumber(bale.damagedPieces))
}

export function getAvailablePieces(bale) {
  return Math.max(
    0,
    toSafeNumber(bale.receivedPieces) -
      toSafeNumber(bale.soldPieces) -
      toSafeNumber(bale.damagedPieces),
  )
}

export function getAverageReceivedCost(bale) {
  const receivedPieces = toSafeNumber(bale.receivedPieces)
  return receivedPieces > 0 ? getTotalInvestment(bale) / receivedPieces : 0
}

export function getEffectiveCostPerSellablePiece(bale) {
  const sellablePieces = getSellablePieces(bale)
  return sellablePieces > 0 ? getTotalInvestment(bale) / sellablePieces : 0
}

export function getSaleProfit({ revenue, piecesSold, unitCost, storeCoveredExpenses = 0 }) {
  return (
    toSafeNumber(revenue) -
    toSafeNumber(piecesSold) * toSafeNumber(unitCost) -
    toSafeNumber(storeCoveredExpenses)
  )
}

export function getSoldPercentage(bale) {
  const receivedPieces = toSafeNumber(bale.receivedPieces)
  if (receivedPieces <= 0) return 0

  // Se limita a 100 para que datos inconsistentes nunca rompan la barra visual.
  return Math.min(100, Math.max(0, (toSafeNumber(bale.soldPieces) / receivedPieces) * 100))
}
