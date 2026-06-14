import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, CardHeader } from '@/components/ui'
import { flowSummaryFromDesign } from './schemeDesignMapper'

type Props = {
  design: SchemeDesign
  preview: Record<string, unknown> | null
}

export function SchemeFlowPreview({ design, preview }: Props) {
  const quote = preview?.deposit_quote as Record<string, string> | undefined
  return (
    <Card>
      <CardHeader title="Live preview" />
      <p className="ds-field__hint" style={{ marginTop: 0 }}>{flowSummaryFromDesign(design)}</p>
      {quote ? (
        <dl className="dash-dl">
          <dt>Sample deposit</dt>
          <dd>₹{quote.total_inr}</dd>
          {quote.gold_grams && quote.gold_grams !== '0.000000' ? (
            <>
              <dt>Gold credited</dt>
              <dd>{quote.gold_grams} g</dd>
            </>
          ) : null}
          {quote.gst_inr && quote.gst_inr !== '0.00' ? (
            <>
              <dt>GST</dt>
              <dd>₹{quote.gst_inr}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="ds-field__hint">Adjust cards to see ₹ breakdown.</p>
      )}
      {preview?.valid === false ? (
        <p className="ds-field__error" role="alert">Design has validation issues.</p>
      ) : null}
    </Card>
  )
}
