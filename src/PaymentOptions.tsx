import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { DEFAULT_CALL_RATES, calculateOfferPayments, centsFromInput, createId, money, quotePricingInputs, type PaymentOption, type Quote, type QuotePricing, type calculateQuotePricing } from './domain'
import { multiplyCents, paymentFactor, paymentPlanLabel, type PaymentPlan } from './paymentPlans'

function paymentKey(payment: PaymentOption) {
  return payment === 'cash' ? 'cash' : `plan:${payment.id}`
}

function percentageInputValue(value: number | undefined, isCalculated: boolean) {
  if (value === undefined) return ''
  return isCalculated ? Number(value.toFixed(2)) : value
}

const effectivePercentage = new Intl.NumberFormat('en-ZA', { style: 'percent', maximumFractionDigits: 2 })

function effectivePercentageLabel(value: number | null) {
  return value === null ? '—' : effectivePercentage.format(value / 100)
}

export function PaymentOptions({ quote, totals, vatRate, plans, onUpdate }: {
  quote: Quote
  totals: ReturnType<typeof calculateQuotePricing>
  vatRate: number
  plans: PaymentPlan[]
  onUpdate: (patch: Partial<Quote>) => void
}) {
  const pricing = quote.pricing ?? {}
  const priceInputs = quotePricingInputs(pricing)
  const { markupPercent, marginPercent, percentageBasis, fixedSalesPriceCents, additionalGpCents } = priceInputs
  const hasFixedPrice = fixedSalesPriceCents !== undefined
  const appliedGpCents = hasFixedPrice ? 0 : additionalGpCents
  const isBelowCost = totals.hasCompleteBaseCosts && totals.profitCents < 0
  const update = (patch: Partial<QuotePricing>) => onUpdate({ pricing: { ...pricing, ...patch } })
  const payments = calculateOfferPayments(quote, vatRate)
  const selected = payments.map(({ payment }) => payment)
  const selectedKeys = new Set(selected.map(paymentKey))
  const showCash = selectedKeys.has('cash')
  const available: PaymentOption[] = ['cash', ...plans]

  function updatePriceInputs(patch: Partial<typeof priceInputs>) {
    update({
      ...priceInputs,
      markupPercent: percentageBasis === 'markup' ? markupPercent : undefined,
      marginPercent: percentageBasis === 'margin' ? marginPercent : undefined,
      adjustment: undefined,
      value: undefined,
      ...patch,
    })
  }

  function updatePercentage(basis: 'markup' | 'margin', input: string) {
    const value = input === '' ? undefined : Math.max(0, Number(input))
    updatePriceInputs({
      markupPercent: basis === 'markup' ? value : undefined,
      marginPercent: basis === 'margin' && value !== undefined ? Math.min(99.99, value) : undefined,
      percentageBasis: value === undefined ? undefined : basis,
    })
  }

  function togglePayment(payment: PaymentOption) {
    const key = paymentKey(payment)
    update({
      plan: undefined,
      paymentOptions: selectedKeys.has(key) ? selected.filter((entry) => paymentKey(entry) !== key) : [...selected, payment],
    })
  }

  return <>
    <div className="preview-meta">
      <span>{appliedGpCents > 0 ? 'Once-off before GP' : 'Once-off subtotal'}</span>
      <b>{money(totals.subtotalCents - appliedGpCents)}</b>
    </div>
    {appliedGpCents > 0 && <div className="preview-meta"><span>Additional GP</span><b>+{money(appliedGpCents)}</b></div>}
    {totals.discountCents > 0 && <div className="preview-meta"><span>Discount</span><b>−{money(totals.discountCents)}</b></div>}
    <div className="preview-meta"><span>VAT ({totals.rate}%)</span><b>{money(totals.vatCents)}</b></div>
    {totals.settlementCents > 0 && <div className="preview-meta"><span>Settlement</span><b>{money(totals.settlementCents)}</b></div>}
    <div className="grand-total" aria-live="polite"><span>Once-off total</span><strong>{money(totals.dueCents)}</strong></div>
    {totals.recurring.totalCents > 0 && <div className="preview-meta"><span>Recurring services</span><b>{money(totals.recurring.totalCents)}</b></div>}
    <div className={isBelowCost ? 'effective-pricing pricing-loss' : 'effective-pricing'}>
      <div className="preview-meta"><span>Effective markup</span><b>{effectivePercentageLabel(totals.effectiveMarkupPercent)}</b></div>
      <div className="preview-meta"><span>Effective margin</span><b>{effectivePercentageLabel(totals.effectiveMarginPercent)}</b></div>
      <div role="status">{isBelowCost && <p>Selling below base cost.</p>}</div>
    </div>
    <details className="quote-line-details payment-controls pricing-adjustments" open><summary>Pricing adjustments</summary>
      <div className="preview-meta"><span>Base cost</span><b>{money(totals.baseCents)}</b></div>
      <div className={isBelowCost ? 'preview-meta pricing-loss' : 'preview-meta'}><span>Gross profit</span><b>{totals.hasCompleteBaseCosts ? money(totals.profitCents) : 'Add base costs'}</b></div>
      <div className="preview-meta"><span>Sales price ex. VAT</span><b>{money(totals.netSaleCents)}</b></div>
      <div className="pricing-fields">
        <label className="pricing-field"><span>Markup (%)</span><input type="number" min="0" step="0.01" disabled={hasFixedPrice} value={percentageInputValue(markupPercent, percentageBasis === 'margin')} onChange={(event) => updatePercentage('markup', event.target.value)} /></label>
        <label className="pricing-field"><span>Margin (%)</span><input type="number" min="0" max="99.99" step="0.01" disabled={hasFixedPrice} value={percentageInputValue(marginPercent === undefined ? undefined : Math.min(99.99, marginPercent), percentageBasis === 'markup')} onChange={(event) => updatePercentage('margin', event.target.value)} /></label>
        <label className="pricing-field"><span>Fixed sales price (ZAR)</span><input type="number" min="0" step="0.01" aria-describedby="fixed-price-hint" value={fixedSalesPriceCents === undefined ? '' : fixedSalesPriceCents / 100} onChange={(event) => {
          const value = event.target.value
          updatePriceInputs({ fixedSalesPriceCents: value === '' ? undefined : Math.max(0, centsFromInput(value)) })
        }} /></label>
        <label className="pricing-field"><span>Additional GP (ZAR)</span><input type="number" min="0" step="0.01" disabled={hasFixedPrice} value={additionalGpCents / 100} onChange={(event) => updatePriceInputs({ additionalGpCents: Math.max(0, centsFromInput(event.target.value)) })} /></label>
        <p className="pricing-basis" aria-live="polite">Using {totals.priceBasis}{appliedGpCents > 0 ? ' + additional GP' : ''}</p>
        <p className="pricing-hint" id="fixed-price-hint">The fixed price is the once-off total, including any applicable VAT and settlement. Leave it blank to use the other pricing adjustments.</p>
      </div>
      <label className="pricing-field"><span>Settlement (ZAR)</span><input type="number" min="0" step="0.01" value={(pricing.settlementCents ?? 0) / 100} onChange={(event) => update({ settlementCents: Math.max(0, centsFromInput(event.target.value)) })} /></label>
      {(pricing.settlementCents ?? 0) > totals.settlementCents && <p className="pricing-hint">Settlement applied up to the fixed price.</p>}
      <div className="discount-control"><label htmlFor="discount-type">Discount</label><select id="discount-type" disabled={hasFixedPrice} value={quote.discountType} onChange={(event) => onUpdate({ discountType: event.target.value as Quote['discountType'] })}><option value="none">None</option><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></select>{quote.discountType !== 'none' && <input aria-label="Discount value" type="number" min="0" step="0.01" disabled={hasFixedPrice} value={quote.discountValue} onChange={(event) => onUpdate({ discountValue: Math.max(0, Number(event.target.value) || 0) })} />}</div>
    </details>
    <section className="proposal-payments" aria-label="Proposal payment options">
      <h4>Payment options on proposal</h4>
      <details className="payment-picker">
        <summary><Plus size={15} /> Add payment options</summary>
        <div className="payment-picker-list">
          {available.map((payment) => <label key={paymentKey(payment)} className="check-field">
            <input type="checkbox" checked={selectedKeys.has(paymentKey(payment))} onChange={() => togglePayment(payment)} />
            <span>{payment === 'cash' ? 'Cash' : paymentPlanLabel(payment)}</span>
          </label>)}
        </div>
      </details>
      {payments.length === 0 && <p>Choose the prices your client should see.</p>}
      {payments.length > 0 && <ul className="selected-payments">
        {payments.map(({ payment, totals }) => {
          const label = payment === 'cash' ? 'Cash' : paymentPlanLabel(payment)
          const updated = payment === 'cash' ? undefined : plans.find((plan) => plan.id === payment.id && JSON.stringify(plan) !== JSON.stringify(payment))
          return <li key={paymentKey(payment)}>
            <div>
              <span className="selected-payment-label">{label}</span>
              {payment === 'cash' ? <>
                <strong>{money(totals.dueCents)} once off</strong>
                {totals.monthlyCents > 0 && <small>{money(totals.monthlyCents)} / month in services</small>}
              </> : totals.factor === null ? <small className="payment-unavailable" role="alert">No factor for this quote value.</small> : <>
                <strong>{money(totals.monthlyCents)} / month</strong>
                {totals.secondYearMonthlyCents !== null && <small>{money(totals.secondYearMonthlyCents)} from month 13</small>}
              </>}
              {updated && <button type="button" className="text-button" onClick={() => update({
                plan: undefined,
                paymentOptions: selected.map((entry) => entry === payment ? updated : entry),
              })}>Use current factors</button>}
            </div>
            <button type="button" className="row-remove" aria-label={`Remove ${label}`} onClick={() => togglePayment(payment)}><X size={14} /></button>
          </li>
        })}
      </ul>}
    </section>
    <details className="quote-line-details payment-controls proposal-display" open><summary>Proposal display</summary>
      <div className="proposal-display-group">
        <label className="check-field"><input type="checkbox" disabled={!showCash} checked={showCash && !pricing.foldSettlement} onChange={(event) => update({ foldSettlement: !event.target.checked })} /><span>Show settlement separately</span></label>
        <label className="check-field"><input type="checkbox" checked={!pricing.hideAccessories} onChange={(event) => update({ hideAccessories: !event.target.checked })} /><span>Show accessories and custom features</span></label>
        <label className="check-field"><input type="checkbox" disabled={!showCash} checked={showCash && !pricing.hideLinePrices} onChange={(event) => update({ hideLinePrices: !event.target.checked })} /><span>Show line item prices</span></label>
        {!showCash && <small className="field-hint">Select Cash to show line prices or settlement.</small>}
      </div>
      <div className="proposal-display-group">
        <h4>Tax</h4>
        <label className="check-field"><input type="checkbox" checked={!pricing.excludeVat} onChange={(event) => update({ excludeVat: !event.target.checked })} /><span>Include {vatRate}% VAT on taxable items</span></label>
      </div>
      <div className="proposal-display-group">
        <h4>Call rates</h4>
        <label className="check-field"><input type="checkbox" checked={pricing.showCallRates ?? false} onChange={(event) => update({ showCallRates: event.target.checked })} /><span>Show call rates on proposal</span></label>
        {pricing.showCallRates && <>
          <label className="field"><span>Local calls</span><input maxLength={48} value={pricing.localCallRate ?? DEFAULT_CALL_RATES.localCallRate} onChange={(event) => update({ localCallRate: event.target.value })} /></label>
          <label className="field"><span>Cellular calls</span><input maxLength={48} value={pricing.cellularCallRate ?? DEFAULT_CALL_RATES.cellularCallRate} onChange={(event) => update({ cellularCallRate: event.target.value })} /></label>
        </>}
      </div>
    </details>
  </>
}

export function PaymentPlanEditor({ initialPlans }: { initialPlans: PaymentPlan[] }) {
  const [plans, setPlans] = useState(initialPlans)
  const [selectedId, setSelectedId] = useState(initialPlans[0]?.id ?? '')
  const [testAmount, setTestAmount] = useState('')
  const selected = plans.find((plan) => plan.id === selectedId)
  const testCents = Math.max(0, centsFromInput(testAmount))
  const testFactor = selected ? paymentFactor(selected, testCents) : null

  function update(patch: Partial<PaymentPlan>) {
    setPlans(plans.map((plan) => plan.id === selectedId ? { ...plan, ...patch } : plan))
  }

  return <div className="payment-plan-editor">
    <div className="panel-heading"><div><h2>Payment factors</h2><p>Each factor applies up to its threshold in rand. A zero factor disables that tier.</p></div></div>
    <input type="hidden" name="paymentPlans" value={JSON.stringify(plans)} />
    <div className="builder-tools">
      <label className="field"><span>Payment plan</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">Select a plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{paymentPlanLabel(plan)}</option>)}
      </select></label>
      <button type="button" className="button button-secondary" onClick={() => {
        const plan = { id: createId(), months: 36, escalation: 0, tiers: [{ limit: 100000, factor: 0 }] }
        setPlans([...plans, plan])
        setSelectedId(plan.id)
      }}><Plus size={15} /> Add plan</button>
    </div>
    {selected && <>
      <div className="form-grid form-grid-two">
        <label className="field"><span>Term (months)</span><input type="number" min="1" required value={selected.months || ''} onChange={(event) => update({ months: Number(event.target.value) })} /></label>
        <label className="field"><span>Annual escalation (%)</span><input type="number" min="0" step="0.01" required value={selected.escalation} onChange={(event) => update({ escalation: Number(event.target.value) })} /></label>
      </div>
      {selected.tiers.map((tier, index) => <div className="payment-tier" key={index}>
        <label className="field"><span>Up to (ZAR)</span><input type="number" min="0.01" step="0.01" required value={tier.limit || ''} onChange={(event) => update({ tiers: selected.tiers.map((entry, i) => i === index ? { ...entry, limit: Number(event.target.value) } : entry) })} /></label>
        <label className="field"><span>Monthly factor</span><input type="number" min="0" step="any" required value={tier.factor} onChange={(event) => update({ tiers: selected.tiers.map((entry, i) => i === index ? { ...entry, factor: Number(event.target.value) } : entry) })} /></label>
        <button type="button" className="row-remove" aria-label={`Remove tier ${index + 1}`} disabled={selected.tiers.length === 1} onClick={() => update({ tiers: selected.tiers.filter((_, i) => i !== index) })}><X size={15} /></button>
      </div>)}
      <div className="builder-tools">
        <button type="button" className="button button-secondary" onClick={() => update({ tiers: [...selected.tiers, { limit: 0, factor: 0 }] })}><Plus size={15} /> Add tier</button>
        <button type="button" className="button button-secondary" onClick={() => {
          setPlans(plans.filter((plan) => plan.id !== selected.id))
          setSelectedId('')
        }}>Remove plan</button>
      </div>
      <div className="payment-factor-test">
        <label className="field"><span>Test once-off value ex. VAT (ZAR)</span><input type="number" min="0" step="0.01" placeholder="Enter a deal value" value={testAmount} onChange={(event) => setTestAmount(event.target.value)} /></label>
        {testAmount && <output>{testFactor === null ? 'No factor available' : `${money(multiplyCents(testCents, testFactor))}/mo ex. VAT · Factor ${testFactor}`}</output>}
      </div>
    </>}
  </div>
}
