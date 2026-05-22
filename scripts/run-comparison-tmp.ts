import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "d676bf3d-e989-4226-bd18-aa349a437c3c",
  compared_take_ids: [
    "d676bf3d-e989-4226-bd18-aa349a437c3c",
    "a01b5fe3-7358-46ee-9942-787153c6ec6d",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));

