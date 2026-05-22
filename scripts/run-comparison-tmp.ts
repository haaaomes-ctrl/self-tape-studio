import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "f7223f2d-81b0-4021-aad7-042516a8fb00",
  compared_take_ids: [
    "f7223f2d-81b0-4021-aad7-042516a8fb00",
    "b1097163-6897-4a4e-ae81-bc95a17af85e",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
