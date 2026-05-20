import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "af8818b7-4c34-413e-9f1a-8c52cf020855",
  compared_take_ids: [
    "af8818b7-4c34-413e-9f1a-8c52cf020855",
    "6bb62561-a8c9-4ea1-9c45-772682f03436",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));

