import { Cable, Cloud, Headset, Network, PackageOpen, Phone, Printer, Radio, ShieldCheck } from 'lucide-react'
import type { Package } from './domain'

const packageIcons: Record<string, typeof PackageOpen> = {
  'reference-lte': Radio,
  'reference-ict-sla': Headset,
  'reference-firewall': ShieldCheck,
  'reference-structured-networks': Network,
  'reference-ineo': Printer,
  'reference-papercut': Printer,
  'reference-hosted': Cloud,
  'reference-on-prem': Phone,
}

export function PackageThumbnail({ item }: { item: Package }) {
  if (item.imageDataUrl) return <img className="catalogue-thumb" src={item.imageDataUrl} alt="" draggable={false} />
  const Icon = packageIcons[item.id] ?? (item.category === 'Networking' ? Cable : PackageOpen)
  return <span className="package-thumbnail" aria-hidden="true"><Icon size={19} /></span>
}
