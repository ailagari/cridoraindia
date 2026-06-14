import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, CardHeader } from '@/components/ui'
import { flowSummaryFromDesign } from './schemeDesignMapper'
import type { SchemePreviewData } from './schemePreviewHelpers'

type Props = {
  design: SchemeDesign
  preview: SchemePreviewData | null
}

export function SchemeFlowPreview({ design, preview }: Props) {
  const nodes = preview?.flow_nodes ?? []
  const quote = preview?.deposit_quote

  return (
    <Card>
      <CardHeader title="Full flow preview" />
      <p className="ds-field__hint" style={{ marginTop: 0 }}>
        {preview?.flow_summary ?? flowSummaryFromDesign(design)}
      </p>

      {nodes.length > 0 ? (
        <ol style={{ margin: 'var(--sp-3) 0 0', paddingLeft: '1.25rem', display: 'grid', gap: 'var(--sp-2)' }}>
          {nodes.map((node, i) => (
            <li key={node.id} style={{ lineHeight: 1.45 }}>
              <strong style={{ fontSize: 'var(--ts-sm)' }}>
                {i + 1}. {node.label}
              </strong>
              {node.detail ? (
                <p className="ds-field__hint" style={{ margin: '0.2rem 0 0' }}>
                  {node.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {quote ? (
        <dl className="dash-dl" style={{ marginTop: 'var(--sp-3)' }}>
          <dt>Sample deposit total</dt>
          <dd>₹{quote.total_inr}</dd>
          {quote.gold_grams && quote.gold_grams !== '0.000000' ? (
            <>
              <dt>Gold credited</dt>
              <dd>{quote.gold_grams} g</dd>
            </>
          ) : null}
          {quote.gst_inr && quote.gst_inr !== '0.00' ? (
            <>
              <dt>GST on gold</dt>
              <dd>₹{quote.gst_inr}</dd>
            </>
          ) : null}
          {quote.making_charge_inr && quote.making_charge_inr !== '0.00' ? (
            <>
              <dt>Making charge</dt>
              <dd>₹{quote.making_charge_inr}</dd>
            </>
          ) : null}
          {quote.gst_on_making_charge_inr && quote.gst_on_making_charge_inr !== '0.00' ? (
            <>
              <dt>GST on making charge</dt>
              <dd>₹{quote.gst_on_making_charge_inr}</dd>
            </>
          ) : null}
          {preview?.example?.estimated_pool_inr != null ? (
            <>
              <dt>Est. pool after plan</dt>
              <dd>₹{preview.example.estimated_pool_inr.toLocaleString('en-IN')}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="ds-field__hint" style={{ marginTop: 'var(--sp-3)' }}>
          Adjust cards to see the worked example.
        </p>
      )}

      {preview?.valid === false ? (
        <p className="ds-field__error" role="alert">
          Design has validation issues.
        </p>
      ) : null}
    </Card>
  )
}
