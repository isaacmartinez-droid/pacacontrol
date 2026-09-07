import { Grid2X2, Home, Package, Plus, Users } from 'lucide-react'

export const navigationItems = [
  { label: 'Inicio', to: '/', icon: Home, matches: ['/'] },
  { label: 'Pacas', to: '/pacas', icon: Package, matches: ['/pacas'] },
  { label: 'Venta', to: '/ventas/nueva', icon: Plus, featured: true, matches: ['/ventas'] },
  { label: 'Clientes', to: '/clientes', icon: Users, matches: ['/clientes'] },
  {
    label: 'Más',
    to: '/mas',
    icon: Grid2X2,
    matches: ['/mas', '/alertas', '/inventario', '/gastos', '/productos-danados', '/reportes'],
  },
]

export function isNavigationItemActive(item, pathname) {
  return item.matches.some((path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path),
  )
}
