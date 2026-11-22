"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/error/action-result";

interface RolePermissionsPanelProps {
  roles: Array<{ id: string; key: string; name: string; description: string | null; permissions: string[] }>;
  permissions: Array<{ key: string; description: string | null }>;
  action: (roleId: string, input: unknown) => Promise<ActionResult<{ roleId: string }>>;
}

export function RolePermissionsPanel({ roles, permissions, action }: RolePermissionsPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(roles.map((role) => [role.id, role.permissions])),
  );
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  function toggle(roleId: string, permissionKey: string) {
    setSelected((current) => {
      const values = current[roleId] ?? [];
      return {
        ...current,
        [roleId]: values.includes(permissionKey)
          ? values.filter((key) => key !== permissionKey)
          : [...values, permissionKey],
      };
    });
  }

  async function save(roleId: string) {
    setPendingRole(roleId);
    const result = await action(roleId, { permissionKeys: selected[roleId] ?? [] });
    setPendingRole(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Role permissions saved");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {roles.map((role) => (
        <Card key={role.id}>
          <CardHeader>
            <CardTitle>{role.name}</CardTitle>
            <CardDescription>
              <span className="font-mono text-xs">{role.key}</span>
              {role.description ? ` — ${role.description}` : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {permissions.map((permission) => {
                const checked = (selected[role.id] ?? []).includes(permission.key);
                return (
                  <label key={permission.key} className="flex items-start gap-2 rounded-md border p-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4"
                      checked={checked}
                      onChange={() => toggle(role.id, permission.key)}
                    />
                    <span>
                      <span className="block font-medium">{permission.key}</span>
                      {permission.description ? (
                        <span className="block text-muted-foreground">{permission.description}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => save(role.id)} disabled={pendingRole === role.id}>
                {pendingRole === role.id ? <Loader2 className="size-4 animate-spin" /> : null}
                Save permissions
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
