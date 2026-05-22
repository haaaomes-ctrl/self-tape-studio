import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "d3730ac6-253a-4c2d-940b-696a2c2e2dcd",
  compared_take_ids: [
    "d3730ac6-253a-4c2d-940b-696a2c2e2dcd",
    "88231d20-9c62-4965-8400-cdf8816fbee2",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
