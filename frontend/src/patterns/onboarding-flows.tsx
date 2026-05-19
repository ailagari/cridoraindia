import type { ReactNode } from 'react'

export type OnboardingStep = {
  id: string
  label: string
  complete?: boolean
  active?: boolean
}

type OnboardingFlowProps = {
  steps: OnboardingStep[]
  children?: ReactNode
}

export function OnboardingFlow({ steps, children }: OnboardingFlowProps) {
  return (
    <section className="onboarding-flow">
      <ol className="onboarding-flow__steps">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={[
              'onboarding-flow__step',
              step.complete ? 'onboarding-flow__step--complete' : '',
              step.active ? 'onboarding-flow__step--active' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="onboarding-flow__index">{index + 1}</span>
            <span className="onboarding-flow__label">{step.label}</span>
          </li>
        ))}
      </ol>
      {children ? <div className="onboarding-flow__body">{children}</div> : null}
    </section>
  )
}
