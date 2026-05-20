import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "34869a93-6fba-456a-baa7-dc71166f917d",
  compared_take_ids: [
    "34869a93-6fba-456a-baa7-dc71166f917d",
    "a1ef113f-d203-499d-aeb2-13f7614043f7",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
