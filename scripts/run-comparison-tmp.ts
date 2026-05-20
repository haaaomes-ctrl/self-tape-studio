import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "cfc9b6aa-a611-403e-9a44-de61106475fc",
  compared_take_ids: [
    "cfc9b6aa-a611-403e-9a44-de61106475fc",
    "2e122516-60f4-4f5f-8ff6-e3417af351dc",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));

