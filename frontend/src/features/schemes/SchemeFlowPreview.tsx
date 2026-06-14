import type { SchemeDesign } from '@/lib/schemesApi'
import { Card } from '@/components/ui'
import { flowSummaryFromDesign } from './schemeDesignMapper'

type Props = {
  design: SchemeDesign
  preview: Record<string, unknown> | null
}

export function SchemeFlowPreview({ design, preview }: Props) {
  const quote = preview?.deposit_quote as Record<string, string> | undefined
  return (
    <Card>
      <h3 className="dash-card-title">Live preview</h3>
      <p className="dash-muted">{flowSummaryFromDesign(design)}</p>
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
        <p className="dash-muted">Adjust cards to see ₹ breakdown.</p>
      )}
      {preview?.valid === false ? (
        <p className="form-error">Design has validation issues.</p>
      ) : null}
    </Card>
  )
}
