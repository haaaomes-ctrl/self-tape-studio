import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "bb115a86-045e-441c-8dd8-ca41f87e4fe0",
  compared_take_ids: [
    "bb115a86-045e-441c-8dd8-ca41f87e4fe0",
    "1e1db9e8-0078-4b85-9c37-d9a7511186bf",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
