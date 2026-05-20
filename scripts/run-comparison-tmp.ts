import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "3b0b514a-f0a7-4c25-9c1f-11d4c42af6af",
  compared_take_ids: [
    "3b0b514a-f0a7-4c25-9c1f-11d4c42af6af",
    "7af75bfd-f2f1-46af-8e6b-4e9c18c871bd",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
