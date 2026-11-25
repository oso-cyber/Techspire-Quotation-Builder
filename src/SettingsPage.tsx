import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { type CompanySettings } from './domain'
import { PaymentPlanEditor } from './PaymentOptions'
import { DEFAULT_PAYMENT_PLANS } from './paymentPlans'

const sections = [
  { id: 'company', label: 'Company' },
  { id: 'quotation', label: 'Quotation defaults' },
  { id: 'terms', label: 'Ordering terms' },
  { id: 'payment', label: 'Payment factors' },
] as const

export function SettingsPage({ settings, onSave }: {
  settings: CompanySettings
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]['id']>('company')
  const [logoDataUrl, setLogoDataUrl] = useState(settings.logoDataUrl)
  const [logoError, setLogoError] = useState('')

  function loadLogo(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('Choose a PNG or JPEG image.')
      return
    }
    if (file.size > 2_000_000) {
      setLogoError('The logo must be 2 MB or smaller.')
      return
    }
    setLogoError('')
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoDataUrl(reader.result)
    }
    reader.onerror = () => setLogoError('The selected logo could not be read.')
    reader.readAsDataURL(file)
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = sections.length - 1
    let nextIndex: number
    switch (event.key) {
      case 'ArrowLeft': nextIndex = index === 0 ? lastIndex : index - 1; break
      case 'ArrowRight': nextIndex = index === lastIndex ? 0 : index + 1; break
      case 'Home': nextIndex = 0; break
      case 'End': nextIndex = lastIndex; break
      default: return
    }
    event.preventDefault()
    const { id } = sections[nextIndex]
    setActiveSection(id)
    document.getElementById(`settings-tab-${id}`)?.focus()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:invalid, textarea:invalid, select:invalid',
    )
    if (!invalid) {
      void onSave(event)
      return
    }
    event.preventDefault()
    const panel = invalid.closest('[role="tabpanel"]')
    const section = sections.find(({ id }) => panel?.id === `settings-panel-${id}`)
    if (section) setActiveSection(section.id)
    requestAnimationFrame(() => {
      invalid.focus()
      invalid.reportValidity()
    })
  }

  return (
    <form className="settings-page" noValidate onSubmit={submit}>
      <div className="page-heading heading-split">
        <div><h1>Settings</h1><p>Manage the company details, defaults and rates used in quotations.</p></div>
        <button type="submit" className="button button-primary"><Check size={16} /> Save settings</button>
      </div>
      <nav aria-label="Settings navigation">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {sections.map(({ id, label }, index) => <button
            key={id}
            type="button"
            id={`settings-tab-${id}`}
            role="tab"
            aria-selected={activeSection === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={activeSection === id ? 0 : -1}
            onClick={() => setActiveSection(id)}
            onKeyDown={(event) => navigateTabs(event, index)}
          >{label}</button>)}
        </div>
      </nav>
      <section className="settings-section" id="settings-panel-company" role="tabpanel" aria-labelledby="settings-tab-company" hidden={activeSection !== 'company'}>
        <div className="panel-heading"><div><h2>Company information</h2><p>Shown on your branded quotation documents.</p></div></div>
        <div className="form-grid form-grid-two">
          <label className="field"><span>Company name</span><input name="name" required defaultValue={settings.name} /></label>
          <label className="field"><span>Prepared by</span><input name="preparedBy" defaultValue={settings.preparedBy} /></label>
          <label className="field"><span>Registration number</span><input name="registrationNumber" defaultValue={settings.registrationNumber} /></label>
          <label className="field"><span>VAT number</span><input name="vatNumber" defaultValue={settings.vatNumber} /></label>
          <label className="field span-two"><span>Business address</span><input name="address" defaultValue={settings.address} /></label>
          <label className="field"><span>Telephone</span><input name="phone" defaultValue={settings.phone} /></label>
          <label className="field"><span>Email</span><input name="email" type="email" defaultValue={settings.email} /></label>
          <label className="field"><span>Website</span><input name="website" defaultValue={settings.website} /></label>
          <div className="span-two settings-logo">
            <label className="field"><span>Company logo (PNG or JPEG)</span><input type="file" accept="image/png,image/jpeg" onChange={(event) => loadLogo(event.target.files?.[0])} /></label>
            <input type="hidden" name="logoDataUrl" value={logoDataUrl} />
            {logoError && <small className="logo-error" role="alert">{logoError}</small>}
            {logoDataUrl && <div className="logo-preview"><img src={logoDataUrl} alt="Company logo preview" /><button type="button" className="table-action danger-link" onClick={() => { setLogoDataUrl(''); setLogoError('') }}>Remove logo</button></div>}
          </div>
        </div>
      </section>
      <section className="settings-section" id="settings-panel-quotation" role="tabpanel" aria-labelledby="settings-tab-quotation" hidden={activeSection !== 'quotation'}>
        <div className="panel-heading"><div><h2>Quotation defaults</h2><p>Applied automatically when you start a new quotation.</p></div></div>
        <div className="form-grid form-grid-two">
          <label className="field"><span>Quotation number prefix</span><input name="quotationPrefix" defaultValue={settings.quotationPrefix} /></label>
          <label className="field"><span>Default validity period (days)</span><input name="validityDays" type="number" min="1" max="365" defaultValue={settings.validityDays} /></label>
          <label className="field"><span>Default VAT rate (%)</span><input name="vatRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.vatRate} /></label>
        </div>
      </section>
      <section className="settings-section" id="settings-panel-terms" role="tabpanel" aria-labelledby="settings-tab-terms" hidden={activeSection !== 'terms'}>
        <div className="panel-heading"><div><h2>Ordering terms</h2><p>Included with new quotations and PDF exports.</p></div></div>
        <div className="form-grid form-grid-two">
          <label className="field span-two"><span>Default ordering terms</span><small>One paragraph per line.</small><textarea name="defaultTerms" rows={12} defaultValue={settings.defaultTerms.map((term) => term.replace('|', ' — ')).join('\n')} /></label>
          <label className="field"><span>Additional payment terms</span><textarea name="paymentTerms" rows={3} defaultValue={settings.paymentTerms} /></label>
          <label className="field"><span>Additional warranty terms</span><textarea name="warrantyTerms" rows={3} defaultValue={settings.warrantyTerms} /></label>
          <label className="field"><span>Additional exclusions</span><textarea name="exclusions" rows={3} defaultValue={settings.exclusions} /></label>
          <label className="field"><span>Additional acceptance wording</span><textarea name="acceptanceWording" rows={3} defaultValue={settings.acceptanceWording} /></label>
        </div>
        <div className="settings-caution"><ShieldCheck size={17} /><span>Only add commercial terms approved by Techspire IT. Terms are saved with each quotation revision.</span></div>
      </section>
      <section className="settings-section" id="settings-panel-payment" role="tabpanel" aria-labelledby="settings-tab-payment" hidden={activeSection !== 'payment'}>
        <PaymentPlanEditor initialPlans={settings.paymentPlans ?? DEFAULT_PAYMENT_PLANS} />
      </section>
    </form>
  )
}
