import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "51acf2df-8a0c-4b71-b935-987af023268e",
  compared_take_ids: [
    "51acf2df-8a0c-4b71-b935-987af023268e",
    "539bd6be-e380-4849-ae6f-f5ce65c30e94",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
