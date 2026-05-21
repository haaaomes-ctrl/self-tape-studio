import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "5c020586-27d5-4fc9-b549-e8e2cb22e598",
  compared_take_ids: [
    "5c020586-27d5-4fc9-b549-e8e2cb22e598",
    "ad85b351-139d-4671-bc40-1cbb06851faa",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
