export default function PageBanner({ children, bannerRef }) {
  return (
    <>
      <div className="page-banner-spacer" />
      <div className="page-banner" ref={bannerRef}>{children}</div>
      <div className="page-banner-push" />
    </>
  )
}
