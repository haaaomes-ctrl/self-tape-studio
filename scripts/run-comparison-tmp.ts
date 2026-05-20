import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "7aed6338-4c79-41b4-b98e-044fed737743",
  compared_take_ids: [
    "7aed6338-4c79-41b4-b98e-044fed737743",
    "a2d07dcd-a5f8-4903-8924-5f833f810d50",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
