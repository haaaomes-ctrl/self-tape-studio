import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "6b3c9e78-7dc6-45ed-a65e-74258aa22b7f",
  compared_take_ids: [
    "6b3c9e78-7dc6-45ed-a65e-74258aa22b7f",
    "7d6646dc-c5fd-4b9b-a4cd-8db89b38e02e",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
