import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "e6601b8f-a924-417a-8d34-e517f2c2bfad",
  compared_take_ids: [
    "e6601b8f-a924-417a-8d34-e517f2c2bfad",
    "a5d36428-0d63-4799-ac46-ce7b6ddf1e1f",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
