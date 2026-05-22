import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "4e7b2754-9629-42b2-ad61-7122b1ef123b",
  compared_take_ids: [
    "4e7b2754-9629-42b2-ad61-7122b1ef123b",
    "1687013f-6fd7-492a-8c6d-9e9dfbda7c8e",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
