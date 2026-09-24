const BRAND_ASSETS = {
  symbol: {
    color: '/brand/controlshop-symbol-color.png',
    black: '/brand/controlshop-symbol-black.png',
    white: '/brand/controlshop-symbol-white.png',
  },
  wordmark: {
    light: '/brand/controlshop-wordmark-light.png',
    dark: '/brand/controlshop-wordmark-dark.png',
  },
}

export function BrandSymbol({ tone = 'color', className = '', alt = 'ControlShop' }) {
  return (
    <img
      src={BRAND_ASSETS.symbol[tone] ?? BRAND_ASSETS.symbol.color}
      alt={alt}
      className={`block object-contain ${className}`}
      draggable="false"
    />
  )
}

export function BrandWordmark({ surface = 'light', className = '', alt = 'ControlShop' }) {
  return (
    <img
      src={BRAND_ASSETS.wordmark[surface] ?? BRAND_ASSETS.wordmark.light}
      alt={alt}
      className={`block object-contain ${className}`}
      draggable="false"
    />
  )
}
