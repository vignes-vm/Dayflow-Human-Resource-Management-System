import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type { ResumeResponse } from "@dayflow/shared";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/lib/api";

export function ResumeTab({ employeeId, editable }: { employeeId: string; editable: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["resume", employeeId],
    queryFn: () => api.get<ResumeResponse>(`/profile/${employeeId}/resume`),
  });

  const [about, setAbout] = useState("");
  const [lovesAboutJob, setLovesAboutJob] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (query.data) {
      setAbout(query.data.about ?? "");
      setLovesAboutJob(query.data.lovesAboutJob ?? "");
      setHobbies(query.data.hobbies ?? "");
    }
  }, [query.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["resume", employeeId] });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/profile/${employeeId}/resume`, { about, lovesAboutJob, hobbies }),
    onSuccess: invalidate,
  });

  const addSkillMutation = useMutation({
    mutationFn: (name: string) => api.post(`/profile/${employeeId}/skills`, { name }),
    onSuccess: () => {
      setNewSkill("");
      invalidate();
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) => api.delete(`/profile/${employeeId}/skills/${skillId}`),
    onSuccess: invalidate,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="about">About</Label>
          <Textarea
            id="about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            onBlur={() => editable && saveMutation.mutate()}
            disabled={!editable}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lovesAboutJob">What I love about my job</Label>
          <Textarea
            id="lovesAboutJob"
            value={lovesAboutJob}
            onChange={(e) => setLovesAboutJob(e.target.value)}
            onBlur={() => editable && saveMutation.mutate()}
            disabled={!editable}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hobbies">My interests and hobbies</Label>
          <Textarea
            id="hobbies"
            value={hobbies}
            onChange={(e) => setHobbies(e.target.value)}
            onBlur={() => editable && saveMutation.mutate()}
            disabled={!editable}
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <Label>Skills</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {query.data.skills.map((s) => (
              <Badge key={s.id} variant="neutral" className="gap-1">
                {s.name}
                {editable ? (
                  <button
                    type="button"
                    onClick={() => removeSkillMutation.mutate(s.id)}
                    aria-label={`Remove ${s.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </Badge>
            ))}
          </div>
          {editable ? (
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Add a skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSkill.trim()) {
                    e.preventDefault();
                    addSkillMutation.mutate(newSkill.trim());
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => newSkill.trim() && addSkillMutation.mutate(newSkill.trim())}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>

        <div>
          <Label>Certifications</Label>
          <div className="mt-2 space-y-2">
            {query.data.certifications.length === 0 ? (
              <p className="text-ink-400 text-sm">None yet.</p>
            ) : (
              query.data.certifications.map((c) => (
                <div key={c.id} className="rounded-card border-border border p-2 text-sm">
                  <p className="font-medium">{c.name}</p>
                  {c.issuer ? <p className="text-ink-500 text-xs">{c.issuer}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
