import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "e7ea321f-d196-400d-95d9-1d268fa32289",
  compared_take_ids: [
    "e7ea321f-d196-400d-95d9-1d268fa32289",
    "f243e0af-91bd-44bc-82df-eb9a593d01e3",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
