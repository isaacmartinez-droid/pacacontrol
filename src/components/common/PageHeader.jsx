import Topbar from '../layout/Topbar'

function PageHeader({ title, description, backTo = '/', eyebrow }) {
  return <Topbar eyebrow={eyebrow} title={title} description={description} backTo={backTo} />
}

export default PageHeader
