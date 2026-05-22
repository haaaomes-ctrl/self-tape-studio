import { runAdminInternalComparisonTriggerImpl } from "@/server-fns/internal-comparison-trigger.functions";

const result = await runAdminInternalComparisonTriggerImpl({
  root_take_id: "8fcc8b89-c822-422c-a597-a6576209078f",
  compared_take_ids: [
    "8fcc8b89-c822-422c-a597-a6576209078f",
    "10811e1b-0785-4d1f-9012-62efed0589f4",
  ],
  source_module: "scripts/run-comparison-tmp.ts",
  source_stage: "admin_internal_comparison_trigger:operator_validation",
  internal_qa_emit: true,
});

console.log(JSON.stringify(result, null, 2));

