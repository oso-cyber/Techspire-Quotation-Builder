export interface PaymentPlan {
  id: string
  name?: string
  months: number
  escalation: number
  tiers: Array<{ limit: number; factor: number }>
}

const standardLimits = [20_000, 50_000, 100_000, 1_000_000_000_000]
const shortLimits = [10_000, 1_000_000, 100_000_000, 1_000_000_000]

function plan(months: number, escalation: number, factors: number[], limits = standardLimits): PaymentPlan {
  return {
    id: `${months}-${escalation}`,
    months,
    escalation,
    tiers: factors.map((factor, index) => ({ limit: limits[index], factor })),
  }
}

export const ADDITIONAL_PAYMENT_PLANS: PaymentPlan[] = [
  plan(24, 5, [0.05444, 0.05217, 0, 0], shortLimits),
  plan(24, 10, [0.05399, 0.05175, 0, 0], shortLimits),
  { ...plan(60, 0, [0.03114, 0.02944, 0, 0], shortLimits), id: 'hr-60-0', name: 'HR' },
]

export const DEFAULT_PAYMENT_PLANS = [
  plan(12, 0, [0.09957, 0.09957, 0.09957, 0.09957], shortLimits),
  plan(18, 5, [0.06819, 0.06819, 0, 0], shortLimits),
  plan(24, 0, [0.05535, 0.05307, 0.05318, 0.05318], shortLimits),
  plan(36, 0, [0.03956, 0.03738, 0.03667, 0.03620]),
  plan(36, 5, [0.03796, 0.03582, 0.03513, 0.03466]),
  plan(36, 8, [0.03378, 0.03378, 0.03378, 0.03378]),
  plan(36, 10, [0.03645, 0.03435, 0.03366, 0.03321]),
  plan(36, 15, [0.03501, 0.03295, 0.03228, 0.03184]),
  plan(48, 0, [0.03313, 0.03081, 0.03006, 0.02956]),
  plan(48, 5, [0.03123, 0.02897, 0.02823, 0.02775]),
  plan(48, 10, [0.02944, 0.02724, 0.02653, 0.02606]),
  plan(48, 15, [0.02776, 0.02562, 0.02493, 0.02448]),
  plan(60, 0, [0.02944, 0.02699, 0.02619, 0.02567]),
  plan(60, 5, [0.02731, 0.02493, 0.02416, 0.02366]),
  plan(60, 10, [0.02532, 0.02302, 0.02228, 0.02179]),
  plan(60, 15, [0.02346, 0.02125, 0.02054, 0.02007]),
  ...ADDITIONAL_PAYMENT_PLANS,
]

export function paymentPlanLabel(plan: PaymentPlan) {
  return `${plan.name ? `${plan.name} ` : ''}${plan.months} months · ${plan.escalation}% annual escalation`
}

export function paymentFactor(plan: PaymentPlan, amountCents: number) {
  return plan.tiers.find((tier) => amountCents <= Math.round(tier.limit * 100))?.factor || null
}

export function multiplyCents(amountCents: number, factor: number, asPercentage = false) {
  if (!Number.isFinite(amountCents) || !Number.isFinite(factor)) return 0
  // Scale the decimal before multiplying so exact half-cents round up.
  const [mantissa, exponent = '0'] = String(factor).split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  const scale = fraction.length - Number(exponent) + (asPercentage ? 2 : 0)
  const product = BigInt(amountCents) * BigInt(whole + fraction)
  if (scale <= 0) return Number(product * 10n ** BigInt(-scale))
  const divisor = 10n ** BigInt(scale)
  return Number((product + divisor / 2n) / divisor)
}
