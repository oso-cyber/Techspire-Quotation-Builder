import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { ItemImage } from './ItemImage'
import { createId, missingClientFields, type Client, type ClientDetails, type Quote } from './domain'

const primary = [
  ['title', 'Title'], ['mobile', 'Mobile number', 'tel'], ['position', 'Position'],
  ['department', 'Department'], ['fax', 'Fax', 'tel'],
] as const
const alternative = [
  ['alternateTitle', 'Title'], ['alternateName', 'Contact name'], ['alternatePhone', 'Phone', 'tel'],
  ['alternateMobile', 'Mobile number', 'tel'], ['alternateEmail', 'Email', 'email'], ['alternatePosition', 'Position'],
] as const
const business = [
  ['website', 'Website'], ['registeredName', 'Registered name'], ['registrationNumber', 'Company registration number'],
  ['accountNumber', 'Account number'], ['coordinates', 'Coordinates'], ['country', 'Country'],
  ['region', 'Region'], ['area', 'Area'], ['sector', 'Sector'],
] as const

export function ClientForm({ client, busy, onCancel, onSubmit }: {
  client: Client | null
  busy: boolean
  onCancel: () => void
  onSubmit: (client: Client) => Promise<void>
}) {
  const [logo, setLogo] = useState(client?.details?.logo)
  const [error, setError] = useState('')
  const details = client?.details

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    if (busy) return
    if (element.querySelector('[data-image-pending]')) {
      setError('Wait for the client logo to finish importing.')
      return
    }
    const form = new FormData(element)
    const value = (key: string) => String(form.get(key) ?? '').trim()
    const profile: Client = {
      id: client?.id ?? createId(),
      archived: client?.archived ?? false,
      name: value('name'),
      contact: value('contact'),
      phone: value('phone'),
      email: value('email'),
      address: value('address'),
      city: value('city'),
      province: value('province'),
      postalCode: value('postalCode'),
      vatNumber: value('vatNumber'),
      details: {
        ...Object.fromEntries([...primary, ...alternative, ...business].map(([key]) => [key, value(key)])),
        position: value('position'),
        logo,
        tags: value('tags'),
        postalAddress: value('postalAddress'),
        currency: value('currency'),
      },
    }
    const missing = missingClientFields(profile)
    if (!profile.name) missing.unshift('client name')
    if (missing.length) {
      setError(`Complete the required fields (${missing.join(', ')}).`)
      return
    }
    setError('')
    await onSubmit(profile)
  }

  function detail([name, label, type]: readonly [keyof ClientDetails, string, string?]) {
    return <ClientField key={name} label={label} name={name} value={details?.[name]} type={type} required={name === 'position'} />
  }

  return (
    <form className="modal-form client-form" onSubmit={(event) => void submit(event)}>
      <p className="client-form-hint">Fields marked in red with an asterisk are required.</p>
      {error && <p className="alert" role="alert">{error}</p>}
      <fieldset className="form-grid form-grid-two">
        <legend>Client</legend>
        <div className="field client-logo"><span>Client logo</span><ItemImage value={logo} onChange={setLogo} name="client logo" /></div>
        <div className="form-grid">
          <ClientField label="Client name" name="name" value={client?.name} required />
          {detail(['tags', 'Tags'])}
        </div>
      </fieldset>
      <div className="client-contacts">
        <fieldset className="form-grid form-grid-two">
          <legend>Primary contact</legend>
          {detail(primary[0])}
          <ClientField label="Contact name" name="contact" value={client?.contact} required />
          <ClientField label="Phone" name="phone" type="tel" value={client?.phone} required />
          {detail(primary[1])}
          <ClientField label="Email" name="email" type="email" value={client?.email} required />
          {primary.slice(2).map(detail)}
        </fieldset>
        <fieldset className="form-grid form-grid-two">
          <legend>Alternative contact</legend>
          {alternative.map(detail)}
        </fieldset>
      </div>
      <fieldset className="form-grid form-grid-two">
        <legend>Business details</legend>
        {business.slice(0, 2).map(detail)}
        <ClientField label="Physical address" name="address" value={client?.address} required multiline />
        <ClientField label="Postal address" name="postalAddress" value={details?.postalAddress} multiline />
        <ClientField label="City" name="city" value={client?.city} />
        <ClientField label="Province" name="province" value={client?.province} />
        <ClientField label="Postal code" name="postalCode" value={client?.postalCode} />
        <ClientField label="Tax / VAT number" name="vatNumber" value={client?.vatNumber} />
        {business.slice(2).map(detail)}
        <label className="field"><span>Currency</span><select name="currency" defaultValue={details?.currency ?? ''}><option value="">Use quotation currency</option><option value="ZAR">ZAR (South African rand)</option></select></label>
      </fieldset>
      <div className="modal-actions">
        <button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button>
        <button className="button button-primary" disabled={busy}><Check size={15} /> {client ? 'Save changes' : 'Save client'}</button>
      </div>
    </form>
  )
}

function ClientField({ label, name, value, type, required, multiline }: {
  label: string
  name: string
  value?: string
  type?: string
  required?: boolean
  multiline?: boolean
}) {
  return (
    <label className="field">
      <span>{label}{required && <i aria-hidden="true"> *</i>}</span>
      {multiline
        ? <textarea name={name} rows={2} defaultValue={value} required={required} />
        : <input name={name} type={type} defaultValue={value} required={required} />}
    </label>
  )
}

export function QuoteCustomerDetails({ quote, onUpdate }: { quote: Quote; onUpdate: (patch: Partial<Quote>) => void }) {
  const details = quote.details
  function update(patch: Quote['details']) {
    onUpdate({ details: { ...details, ...patch } })
  }
  return (
    <details className="quote-customer-details">
      <summary>Additional quotation details</summary>
      <div className="form-grid form-grid-three">
        <label className="field"><span>Rating</span><select value={details?.rating ?? ''} onChange={(event) => update({ rating: Number(event.target.value) || undefined })}>
          <option value="">Unrated</option>
          {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
        </select></label>
        <label className="field"><span>Expected closure</span><input type="date" value={details?.expectedClosure ?? ''} onChange={(event) => update({ expectedClosure: event.target.value })} /></label>
        <label className="field"><span>Reference</span><input value={details?.reference ?? ''} onChange={(event) => update({ reference: event.target.value })} /></label>
        <label className="field span-three"><span>Private notes</span><textarea rows={2} value={details?.privateNotes ?? ''} onChange={(event) => update({ privateNotes: event.target.value })} /></label>
      </div>
    </details>
  )
}
