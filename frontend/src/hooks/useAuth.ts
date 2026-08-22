import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@dayflow/shared";

import { api, ApiClientError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useAuth() {
  const query = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.get<MeResponse>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });

  const unauthenticated =
    query.isError && query.error instanceof ApiClientError && query.error.status === 401;

  return {
    me: query.data,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data && !unauthenticated,
    unauthenticated,
    refetch: query.refetch,
  };
}
