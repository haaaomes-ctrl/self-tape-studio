import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "b4648c8a-10a0-489d-a780-2b1fd072f652",
  compared_take_ids: [
    "b4648c8a-10a0-489d-a780-2b1fd072f652",
    "85e1e167-40b4-41cf-a321-8af49fe0bd0b",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
