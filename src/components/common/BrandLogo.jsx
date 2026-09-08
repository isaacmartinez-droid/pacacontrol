export default function BrandLogo({ className = '' }) {
  return (
    <img
      src="/logo-tienda-jf.jpeg"
      alt=""
      aria-hidden="true"
      className={`block size-full object-cover ${className}`}
    />
  )
}
