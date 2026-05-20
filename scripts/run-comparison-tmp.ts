import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "0f8da633-c366-4cdd-9a5f-5632494c3c03",
  compared_take_ids: [
    "0f8da633-c366-4cdd-9a5f-5632494c3c03",
    "234e054c-6c4c-4b20-a3ee-efe0569de6ba",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));

