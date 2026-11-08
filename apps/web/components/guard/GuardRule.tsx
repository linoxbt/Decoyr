import { Badge } from "@/components/ui/Badge";
import type { GuardRule } from "@/lib/schemas";

export function GuardRuleRow({ rule }: { rule: GuardRule }) {
  return (
    <tr id={rule.id} className="border-b border-border last:border-0 target:bg-blocked-bg/50">
      <td className="mono px-3 py-2 text-[12.5px]">{rule.capability}</td>
      <td className="px-3 py-2">
        <Badge tone={rule.decision === "allow" ? "success" : "blocked"}>{rule.decision === "allow" ? "Allow" : "Deny"}</Badge>
      </td>
      <td className="mono px-3 py-2 text-[12.5px]">{rule.constraint}</td>
      <td className="px-3 py-2 text-[13px]">{rule.reason}</td>
      <td className="px-3 py-2 text-[12px] text-muted">{rule.enforcedAt}</td>
      <td className="px-3 py-2 text-right text-[12px] text-muted tabular-nums">{rule.evidenceEventIds.length}</td>
    </tr>
  );
}
