import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "98543ff6-415e-41ed-adaa-da9dec4b75bb",
  compared_take_ids: [
    "98543ff6-415e-41ed-adaa-da9dec4b75bb",
    "76709d9b-342a-4749-ab46-5f7fc8a5df7e",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));
