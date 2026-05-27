-- DS-17: CFO dashboards, margins and B2B break-even.
--
-- This composes the existing credit ledger, partner package/pool, Stripe
-- revenue ledger and DS-16 AI cost baseline into private finance views. It is
-- intentionally read-only and does not change credit enforcement, Stripe
-- processing, AI judgement, prompts or performer-facing report output.

CREATE OR REPLACE VIEW public.cfo_report_funding_dashboard AS
SELECT
  date_trunc('month', costs.take_created_at)::DATE AS month_start,
  CASE
    WHEN costs.credit_source IN ('free_signup', 'free_monthly', 'platform_funded', 'admin_grant')
      THEN 'free_report_subsidy'
    WHEN costs.credit_source IN ('school_funded', 'coach_funded', 'agent_funded', 'sponsor_campaign')
      THEN 'partner_funded'
    WHEN costs.credit_source = 'user_paid'
      THEN 'user_paid'
    WHEN costs.synthetic_usage
      THEN 'synthetic_or_test'
    ELSE 'unknown'
  END AS funding_bucket,
  costs.credit_source::TEXT AS credit_source,
  costs.partner_id,
  costs.partner_name,
  costs.partner_type,
  costs.duration_status,
  COALESCE(costs.commercial_metrics_excluded, FALSE) AS commercial_metrics_excluded,
  COUNT(*)::INTEGER AS report_count,
  ROUND(COALESCE(SUM(costs.report_estimated_cost_usd), 0), 6) AS estimated_ai_cost_usd,
  ROUND(COALESCE(SUM(costs.report_estimated_cost_usd), 0) * 0.800000, 2)
    AS estimated_ai_cost_gbp,
  ROUND(COALESCE(AVG(costs.report_estimated_cost_usd), 0), 6) AS average_ai_cost_usd,
  ROUND(COALESCE(AVG(costs.report_estimated_cost_usd), 0) * 0.800000, 2)
    AS average_ai_cost_gbp,
  0.800000::NUMERIC(8, 6) AS planning_usd_to_gbp_rate,
  'planning_fx_rate'::TEXT AS cost_fx_source
FROM public.take_ai_report_costs costs
GROUP BY
  date_trunc('month', costs.take_created_at)::DATE,
  CASE
    WHEN costs.credit_source IN ('free_signup', 'free_monthly', 'platform_funded', 'admin_grant')
      THEN 'free_report_subsidy'
    WHEN costs.credit_source IN ('school_funded', 'coach_funded', 'agent_funded', 'sponsor_campaign')
      THEN 'partner_funded'
    WHEN costs.credit_source = 'user_paid'
      THEN 'user_paid'
    WHEN costs.synthetic_usage
      THEN 'synthetic_or_test'
    ELSE 'unknown'
  END,
  costs.credit_source::TEXT,
  costs.partner_id,
  costs.partner_name,
  costs.partner_type,
  costs.duration_status,
  COALESCE(costs.commercial_metrics_excluded, FALSE);

CREATE OR REPLACE VIEW public.cfo_report_cost_by_report_dashboard AS
SELECT
  costs.take_id,
  costs.audition_id,
  costs.user_id,
  date_trunc('month', costs.take_created_at)::DATE AS month_start,
  costs.take_created_at AS report_created_at,
  costs.take_status,
  costs.overall_score,
  CASE
    WHEN costs.credit_source IN ('free_signup', 'free_monthly', 'platform_funded', 'admin_grant')
      THEN 'free_report_subsidy'
    WHEN costs.credit_source IN ('school_funded', 'coach_funded', 'agent_funded', 'sponsor_campaign')
      THEN 'partner_funded'
    WHEN costs.credit_source = 'user_paid'
      THEN 'user_paid'
    WHEN costs.synthetic_usage
      THEN 'synthetic_or_test'
    ELSE 'unknown'
  END AS funding_bucket,
  costs.credit_source::TEXT AS credit_source,
  costs.partner_id,
  costs.partner_name,
  costs.partner_type,
  costs.duration_status,
  COALESCE(costs.commercial_metrics_excluded, FALSE) AS commercial_metrics_excluded,
  costs.ai_call_count,
  costs.failed_call_count,
  costs.fallback_call_count,
  costs.repair_call_count,
  costs.report_cost_source,
  ROUND(COALESCE(costs.report_estimated_cost_usd, 0), 6) AS estimated_ai_cost_usd,
  ROUND(COALESCE(costs.report_estimated_cost_usd, 0) * 0.800000, 2)
    AS estimated_ai_cost_gbp,
  0.800000::NUMERIC(8, 6) AS planning_usd_to_gbp_rate,
  'planning_fx_rate'::TEXT AS cost_fx_source,
  costs.last_ai_usage_at
FROM public.take_ai_report_costs costs;

CREATE OR REPLACE VIEW public.cfo_partner_revenue_source_dashboard AS
SELECT
  pool.id AS partner_credit_pool_id,
  pool.partner_id,
  partner.name AS partner_name,
  partner.type AS partner_type,
  pool.name AS pool_name,
  pool.period_type,
  date_trunc('month', pool.period_start)::DATE AS revenue_month,
  pool.period_start,
  pool.period_end,
  pool.total_credits,
  pool.allocated_credits,
  pool.consumed_credits,
  pool.per_user_cap,
  COALESCE(revenue_meta.metadata_revenue_pence, preset.unit_amount_pence, 0)::INTEGER
    AS partner_revenue_pence,
  ROUND(
    COALESCE(revenue_meta.metadata_revenue_pence, preset.unit_amount_pence, 0)::NUMERIC / 100.0,
    2
  ) AS partner_revenue_gbp,
  CASE
    WHEN revenue_meta.metadata_revenue_pence IS NOT NULL THEN 'pool_metadata_recorded_revenue'
    WHEN preset.id IS NOT NULL THEN 'package_preset_planning_revenue'
    ELSE 'not_recorded'
  END AS partner_revenue_source,
  preset.sku AS package_sku,
  preset.name AS package_name,
  preset.billing_period AS package_billing_period,
  preset.unit_amount_pence AS package_unit_amount_pence
FROM public.partner_credit_pools pool
JOIN public.partners partner ON partner.id = pool.partner_id
LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN (pool.metadata ->> 'partner_revenue_pence') ~ '^[0-9]+$'
        THEN (pool.metadata ->> 'partner_revenue_pence')::INTEGER
      WHEN (pool.metadata ->> 'contract_value_pence') ~ '^[0-9]+$'
        THEN (pool.metadata ->> 'contract_value_pence')::INTEGER
      WHEN (pool.metadata ->> 'invoice_amount_pence') ~ '^[0-9]+$'
        THEN (pool.metadata ->> 'invoice_amount_pence')::INTEGER
      WHEN (pool.metadata ->> 'unit_amount_pence') ~ '^[0-9]+$'
        THEN (pool.metadata ->> 'unit_amount_pence')::INTEGER
      WHEN (pool.metadata ->> 'package_amount_pence') ~ '^[0-9]+$'
        THEN (pool.metadata ->> 'package_amount_pence')::INTEGER
      ELSE NULL
    END AS metadata_revenue_pence
) revenue_meta ON TRUE
LEFT JOIN LATERAL (
  SELECT preset_row.*
  FROM public.partner_package_presets preset_row
  WHERE preset_row.active = TRUE
    AND (
      preset_row.sku = NULLIF(pool.metadata ->> 'package_sku', '')
      OR (
        NULLIF(pool.metadata ->> 'package_sku', '') IS NULL
        AND preset_row.partner_type = partner.type
        AND preset_row.total_credits = pool.total_credits
        AND preset_row.per_user_cap = pool.per_user_cap
      )
    )
  ORDER BY
    CASE WHEN preset_row.sku = NULLIF(pool.metadata ->> 'package_sku', '') THEN 0 ELSE 1 END,
    preset_row.display_order,
    preset_row.sku
  LIMIT 1
) preset ON TRUE;

CREATE OR REPLACE VIEW public.cfo_revenue_ledger_dashboard AS
WITH payment_refunds AS (
  SELECT
    ledger.payment_id,
    SUM(ledger.amount_pence)::INTEGER AS refunds_or_disputes_pence
  FROM public.consumer_credit_revenue_ledger_entries ledger
  WHERE ledger.event_type IN ('refund', 'dispute')
    AND ledger.processing_status = 'processed'
    AND ledger.payment_id IS NOT NULL
  GROUP BY ledger.payment_id
),
consumer_revenue AS (
  SELECT
    date_trunc('month', payment.updated_at)::DATE AS month_start,
    'user_paid_credit_packs'::TEXT AS revenue_stream,
    NULL::UUID AS partner_id,
    NULL::TEXT AS partner_name,
    NULL::public.partner_type AS partner_type,
    SUM(payment.amount_total_pence)::INTEGER AS gross_revenue_pence,
    COALESCE(SUM(payment_refunds.refunds_or_disputes_pence), 0)::INTEGER
      AS refunds_or_disputes_pence,
    (
      SUM(payment.amount_total_pence)
      - COALESCE(SUM(payment_refunds.refunds_or_disputes_pence), 0)
    )::INTEGER AS net_revenue_pence,
    COUNT(*)::INTEGER AS transaction_count,
    'consumer_credit_payments'::TEXT AS revenue_source
  FROM public.consumer_credit_payments payment
  LEFT JOIN payment_refunds ON payment_refunds.payment_id = payment.id
  WHERE payment.status IN ('checkout_completed', 'payment_succeeded')
  GROUP BY date_trunc('month', payment.updated_at)::DATE
),
partner_revenue AS (
  SELECT
    partner_revenue.revenue_month AS month_start,
    'partner_funded_packages'::TEXT AS revenue_stream,
    partner_revenue.partner_id,
    partner_revenue.partner_name,
    partner_revenue.partner_type,
    SUM(partner_revenue.partner_revenue_pence)::INTEGER AS gross_revenue_pence,
    0::INTEGER AS refunds_or_disputes_pence,
    SUM(partner_revenue.partner_revenue_pence)::INTEGER AS net_revenue_pence,
    COUNT(*)::INTEGER AS transaction_count,
    string_agg(DISTINCT partner_revenue.partner_revenue_source, ', ' ORDER BY partner_revenue.partner_revenue_source)
      AS revenue_source
  FROM public.cfo_partner_revenue_source_dashboard partner_revenue
  WHERE partner_revenue.partner_revenue_pence > 0
  GROUP BY
    partner_revenue.revenue_month,
    partner_revenue.partner_id,
    partner_revenue.partner_name,
    partner_revenue.partner_type
)
SELECT * FROM consumer_revenue
UNION ALL
SELECT * FROM partner_revenue;

CREATE OR REPLACE VIEW public.cfo_partner_margin_dashboard AS
WITH partner_report_costs AS (
  SELECT
    costs.partner_id,
    COUNT(*)::INTEGER AS partner_funded_report_count,
    ROUND(COALESCE(SUM(costs.report_estimated_cost_usd), 0), 6) AS estimated_ai_cost_usd,
    ROUND(COALESCE(SUM(costs.report_estimated_cost_usd), 0) * 0.800000, 2)
      AS estimated_ai_cost_gbp,
    MAX(costs.last_ai_usage_at) AS latest_report_cost_at
  FROM public.take_ai_report_costs costs
  WHERE costs.partner_id IS NOT NULL
    AND COALESCE(costs.commercial_metrics_excluded, FALSE) = FALSE
  GROUP BY costs.partner_id
),
partner_revenue AS (
  SELECT
    revenue.partner_id,
    SUM(revenue.partner_revenue_pence)::INTEGER AS partner_revenue_pence,
    string_agg(DISTINCT revenue.partner_revenue_source, ', ' ORDER BY revenue.partner_revenue_source)
      AS partner_revenue_source
  FROM public.cfo_partner_revenue_source_dashboard revenue
  GROUP BY revenue.partner_id
),
partner_keys AS (
  SELECT partner_id FROM partner_report_costs
  UNION
  SELECT partner_id FROM partner_revenue
)
SELECT
  partner_keys.partner_id,
  partner.name AS partner_name,
  partner.type AS partner_type,
  COALESCE(partner_report_costs.partner_funded_report_count, 0)::INTEGER
    AS partner_funded_report_count,
  COALESCE(partner_report_costs.estimated_ai_cost_usd, 0) AS estimated_ai_cost_usd,
  COALESCE(partner_report_costs.estimated_ai_cost_gbp, 0) AS estimated_ai_cost_gbp,
  COALESCE(partner_revenue.partner_revenue_pence, 0)::INTEGER AS partner_revenue_pence,
  ROUND(COALESCE(partner_revenue.partner_revenue_pence, 0)::NUMERIC / 100.0, 2)
    AS partner_revenue_gbp,
  ROUND(
    (COALESCE(partner_revenue.partner_revenue_pence, 0)::NUMERIC / 100.0)
      - COALESCE(partner_report_costs.estimated_ai_cost_gbp, 0),
    2
  ) AS gross_margin_gbp,
  CASE
    WHEN COALESCE(partner_revenue.partner_revenue_pence, 0) <= 0 THEN NULL
    ELSE ROUND(
      (
        (COALESCE(partner_revenue.partner_revenue_pence, 0)::NUMERIC / 100.0)
        - COALESCE(partner_report_costs.estimated_ai_cost_gbp, 0)
      ) / (COALESCE(partner_revenue.partner_revenue_pence, 0)::NUMERIC / 100.0),
      4
    )
  END AS gross_margin_rate,
  0.7000::NUMERIC(5, 4) AS paid_pack_margin_guardrail,
  CASE
    WHEN COALESCE(partner_revenue.partner_revenue_pence, 0) <= 0 THEN 'revenue_not_recorded'
    WHEN (
      (
        (COALESCE(partner_revenue.partner_revenue_pence, 0)::NUMERIC / 100.0)
        - COALESCE(partner_report_costs.estimated_ai_cost_gbp, 0)
      ) / (COALESCE(partner_revenue.partner_revenue_pence, 0)::NUMERIC / 100.0)
    ) >= 0.7000 THEN 'meets_70_percent_guardrail'
    ELSE 'below_70_percent_guardrail'
  END AS gross_margin_guardrail_status,
  COALESCE(partner_revenue.partner_revenue_source, 'not_recorded') AS partner_revenue_source,
  partner_report_costs.latest_report_cost_at
FROM partner_keys
JOIN public.partners partner ON partner.id = partner_keys.partner_id
LEFT JOIN partner_report_costs ON partner_report_costs.partner_id = partner_keys.partner_id
LEFT JOIN partner_revenue ON partner_revenue.partner_id = partner_keys.partner_id;

CREATE OR REPLACE VIEW public.cfo_free_report_subsidy_dashboard AS
SELECT
  funding.month_start,
  funding.credit_source,
  funding.duration_status,
  SUM(funding.report_count)::INTEGER AS free_report_count,
  ROUND(COALESCE(SUM(funding.estimated_ai_cost_usd), 0), 6) AS estimated_subsidy_cost_usd,
  ROUND(COALESCE(SUM(funding.estimated_ai_cost_gbp), 0), 2) AS estimated_subsidy_cost_gbp,
  ROUND(COALESCE(AVG(funding.average_ai_cost_usd), 0), 6) AS average_free_report_cost_usd,
  ROUND(COALESCE(AVG(funding.average_ai_cost_gbp), 0), 2) AS average_free_report_cost_gbp,
  funding.cost_fx_source
FROM public.cfo_report_funding_dashboard funding
WHERE funding.funding_bucket = 'free_report_subsidy'
  AND funding.commercial_metrics_excluded = FALSE
GROUP BY
  funding.month_start,
  funding.credit_source,
  funding.duration_status,
  funding.cost_fx_source;

CREATE OR REPLACE VIEW public.cfo_paid_credit_liability_summary AS
WITH payment_prices AS (
  SELECT DISTINCT ON (payment.credit_grant_id)
    payment.credit_grant_id,
    payment.product_sku,
    payment.amount_total_pence,
    payment.credit_amount,
    ROUND(payment.amount_total_pence::NUMERIC / payment.credit_amount::NUMERIC, 4)
      AS paid_unit_price_pence
  FROM public.consumer_credit_payments payment
  WHERE payment.credit_grant_id IS NOT NULL
    AND payment.status IN ('checkout_completed', 'payment_succeeded')
  ORDER BY payment.credit_grant_id, payment.updated_at DESC
),
grant_pricing AS (
  SELECT
    grant_row.id AS credit_grant_id,
    COALESCE(
      payment_prices.product_sku,
      NULLIF(grant_row.source_label, ''),
      NULLIF(grant_row.metadata ->> 'product_sku', ''),
      'unknown'
    ) AS product_sku,
    grant_row.original_credits,
    grant_row.remaining_credits,
    payment_prices.paid_unit_price_pence,
    ROUND(product.unit_amount_pence::NUMERIC / NULLIF(product.credit_amount, 0)::NUMERIC, 4)
      AS product_unit_price_pence,
    CASE
      WHEN payment_prices.paid_unit_price_pence IS NOT NULL THEN 'payment_price'
      WHEN product.unit_amount_pence IS NOT NULL THEN 'catalogue_price'
      ELSE 'unpriced'
    END AS pricing_source
  FROM public.credit_grants grant_row
  LEFT JOIN payment_prices ON payment_prices.credit_grant_id = grant_row.id
  LEFT JOIN public.consumer_credit_products product
    ON product.sku = COALESCE(
      payment_prices.product_sku,
      NULLIF(grant_row.source_label, ''),
      NULLIF(grant_row.metadata ->> 'product_sku', '')
    )
  WHERE grant_row.source = 'user_paid'
)
SELECT
  product_sku,
  COUNT(*)::INTEGER AS paid_credit_grant_count,
  SUM(original_credits)::INTEGER AS original_paid_credits,
  SUM(remaining_credits)::INTEGER AS unused_paid_credits,
  ROUND(
    COALESCE(
      SUM(
        remaining_credits::NUMERIC
        * COALESCE(paid_unit_price_pence, product_unit_price_pence, 0)
      ),
      0
    ),
    2
  ) AS estimated_unused_paid_credit_liability_pence,
  ROUND(
    COALESCE(
      SUM(
        remaining_credits::NUMERIC
        * COALESCE(paid_unit_price_pence, product_unit_price_pence, 0)
      ),
      0
    ) / 100.0,
    2
  ) AS estimated_unused_paid_credit_liability_gbp,
  COUNT(*) FILTER (WHERE pricing_source = 'payment_price')::INTEGER AS payment_priced_grants,
  COUNT(*) FILTER (WHERE pricing_source = 'catalogue_price')::INTEGER AS catalogue_priced_grants,
  COUNT(*) FILTER (WHERE pricing_source = 'unpriced')::INTEGER AS unpriced_grants,
  CASE
    WHEN COUNT(*) FILTER (WHERE pricing_source = 'unpriced') > 0 THEN 'partial_pricing'
    WHEN COUNT(*) FILTER (WHERE pricing_source = 'catalogue_price') > 0 THEN 'catalogue_estimate'
    ELSE 'payment_recorded'
  END AS liability_pricing_status
FROM grant_pricing
GROUP BY product_sku;

CREATE OR REPLACE VIEW public.cfo_monthly_burn_dashboard AS
WITH months AS (
  SELECT month_start FROM public.cfo_report_funding_dashboard WHERE month_start IS NOT NULL
  UNION
  SELECT month_start FROM public.cfo_revenue_ledger_dashboard WHERE month_start IS NOT NULL
),
report_rollup AS (
  SELECT
    funding.month_start,
    SUM(funding.report_count)::INTEGER AS report_count,
    COALESCE(
      SUM(funding.report_count) FILTER (WHERE funding.funding_bucket = 'free_report_subsidy'),
      0
    )::INTEGER
      AS free_report_count,
    COALESCE(
      SUM(funding.report_count) FILTER (WHERE funding.funding_bucket = 'partner_funded'),
      0
    )::INTEGER
      AS partner_funded_report_count,
    COALESCE(
      SUM(funding.report_count) FILTER (WHERE funding.funding_bucket = 'user_paid'),
      0
    )::INTEGER
      AS user_paid_report_count,
    ROUND(COALESCE(SUM(funding.estimated_ai_cost_gbp), 0), 2) AS ai_variable_cost_gbp
  FROM public.cfo_report_funding_dashboard funding
  WHERE funding.commercial_metrics_excluded = FALSE
  GROUP BY funding.month_start
),
revenue_rollup AS (
  SELECT
    revenue.month_start,
    ROUND(COALESCE(SUM(revenue.net_revenue_pence), 0)::NUMERIC / 100.0, 2)
      AS net_revenue_gbp,
    ROUND(COALESCE(SUM(revenue.gross_revenue_pence), 0)::NUMERIC / 100.0, 2)
      AS gross_revenue_gbp
  FROM public.cfo_revenue_ledger_dashboard revenue
  GROUP BY revenue.month_start
)
SELECT
  months.month_start,
  COALESCE(report_rollup.report_count, 0)::INTEGER AS report_count,
  COALESCE(report_rollup.free_report_count, 0)::INTEGER AS free_report_count,
  COALESCE(report_rollup.partner_funded_report_count, 0)::INTEGER AS partner_funded_report_count,
  COALESCE(report_rollup.user_paid_report_count, 0)::INTEGER AS user_paid_report_count,
  COALESCE(revenue_rollup.gross_revenue_gbp, 0) AS gross_revenue_gbp,
  COALESCE(revenue_rollup.net_revenue_gbp, 0) AS net_revenue_gbp,
  COALESCE(report_rollup.ai_variable_cost_gbp, 0) AS ai_variable_cost_gbp,
  200.00::NUMERIC(10, 2) AS chatgpt_codex_monthly_cost_gbp,
  22.00::NUMERIC(10, 2) AS lovable_monthly_cost_gbp,
  275.00::NUMERIC(10, 2) AS planning_fixed_monthly_burn_gbp,
  ROUND(275.00 + COALESCE(report_rollup.ai_variable_cost_gbp, 0), 2)
    AS total_monthly_burn_gbp,
  ROUND(
    COALESCE(revenue_rollup.net_revenue_gbp, 0)
      - COALESCE(report_rollup.ai_variable_cost_gbp, 0),
    2
  ) AS contribution_after_ai_cost_gbp,
  GREATEST(
    ROUND(
      275.00
        + COALESCE(report_rollup.ai_variable_cost_gbp, 0)
        - COALESCE(revenue_rollup.net_revenue_gbp, 0),
      2
    ),
    0
  ) AS break_even_gap_gbp
FROM months
LEFT JOIN report_rollup ON report_rollup.month_start = months.month_start
LEFT JOIN revenue_rollup ON revenue_rollup.month_start = months.month_start;

CREATE OR REPLACE VIEW public.cfo_revenue_milestone_dashboard AS
WITH current_month AS (
  SELECT date_trunc('month', now())::DATE AS month_start
),
current_revenue AS (
  SELECT
    current_month.month_start,
    ROUND(COALESCE(SUM(revenue.net_revenue_pence), 0)::NUMERIC / 100.0, 2)
      AS current_month_net_revenue_gbp
  FROM current_month
  LEFT JOIN public.cfo_revenue_ledger_dashboard revenue
    ON revenue.month_start = current_month.month_start
  GROUP BY current_month.month_start
),
milestones AS (
  SELECT * FROM (VALUES (100), (300), (1000), (2500)) AS milestone(milestone_gbp)
)
SELECT
  current_revenue.month_start,
  milestones.milestone_gbp::INTEGER AS milestone_gbp,
  current_revenue.current_month_net_revenue_gbp,
  current_revenue.current_month_net_revenue_gbp >= milestones.milestone_gbp::NUMERIC
    AS reached,
  GREATEST(
    ROUND(milestones.milestone_gbp::NUMERIC - current_revenue.current_month_net_revenue_gbp, 2),
    0
  ) AS remaining_gbp,
  LEAST(
    ROUND(
      current_revenue.current_month_net_revenue_gbp
        / milestones.milestone_gbp::NUMERIC,
      4
    ),
    1
  ) AS progress_rate
FROM current_revenue
CROSS JOIN milestones;

REVOKE ALL ON TABLE public.cfo_report_funding_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_report_cost_by_report_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_partner_revenue_source_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_revenue_ledger_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_partner_margin_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_free_report_subsidy_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_paid_credit_liability_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_monthly_burn_dashboard FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.cfo_revenue_milestone_dashboard FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.cfo_report_funding_dashboard TO service_role;
GRANT SELECT ON TABLE public.cfo_report_cost_by_report_dashboard TO service_role;
GRANT SELECT ON TABLE public.cfo_partner_revenue_source_dashboard TO service_role;
GRANT SELECT ON TABLE public.cfo_revenue_ledger_dashboard TO service_role;
GRANT SELECT ON TABLE public.cfo_partner_margin_dashboard TO service_role;
GRANT SELECT ON TABLE public.cfo_free_report_subsidy_dashboard TO service_role;
GRANT SELECT ON TABLE public.cfo_paid_credit_liability_summary TO service_role;
GRANT SELECT ON TABLE public.cfo_monthly_burn_dashboard TO service_role;
GRANT SELECT ON TABLE public.cfo_revenue_milestone_dashboard TO service_role;
