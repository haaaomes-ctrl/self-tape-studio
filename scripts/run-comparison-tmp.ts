import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "ff22458a-f1bc-406f-89d6-b836ea6d5b28",
  compared_take_ids: [
    "ff22458a-f1bc-406f-89d6-b836ea6d5b28",
    "61c4550a-1551-429e-b570-911d1674aceb",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
