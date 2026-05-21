import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "51171eb3-6c9f-4853-94cb-d05960c57876",
  compared_take_ids: [
    "51171eb3-6c9f-4853-94cb-d05960c57876",
    "0a38f34c-2f6c-4f88-aff0-893f5d8dbbe2",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
