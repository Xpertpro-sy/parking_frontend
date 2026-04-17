import { useQuery } from "@tanstack/react-query";
import { getVehicleByIdRequest, listVehiclesRequest } from "@/lib/vehicle-api";

export const vehicleQueryKeys = {
  all: ["vehicles"] as const,
  list: () => [...vehicleQueryKeys.all, "list"] as const,
  detail: (id: string) => [...vehicleQueryKeys.all, "detail", id] as const,
};

const VEHICLE_STALE_TIME_MS = 3 * 60 * 1000;
const VEHICLE_GC_TIME_MS = 10 * 60 * 1000;

/**
 * Intervalle de re-fetch pour que plusieurs utilisateurs (admin / gestionnaires) voient
 * les ventes, locations et réservations sans attendre l’invalidation locale du cache.
 */
export const LIVE_COLLAB_REFETCH_MS = 8_000;

export type VehicleQueriesLiveOption = {
  /** Active un polling léger + données toujours considérées comme périmées pour ce hook. */
  live?: boolean;
};

export function useVehiclesQuery(options?: VehicleQueriesLiveOption) {
  const live = options?.live === true;
  return useQuery({
    queryKey: vehicleQueryKeys.list(),
    queryFn: listVehiclesRequest,
    staleTime: live ? 0 : VEHICLE_STALE_TIME_MS,
    gcTime: VEHICLE_GC_TIME_MS,
    refetchInterval: live ? LIVE_COLLAB_REFETCH_MS : false,
    refetchOnWindowFocus: live,
  });
}

export function useVehicleDetailQuery(id: string | undefined, options?: VehicleQueriesLiveOption) {
  const live = options?.live === true;
  return useQuery({
    queryKey: vehicleQueryKeys.detail(id ?? ""),
    queryFn: () => getVehicleByIdRequest(id ?? ""),
    enabled: Boolean(id),
    staleTime: live ? 0 : VEHICLE_STALE_TIME_MS,
    gcTime: VEHICLE_GC_TIME_MS,
    refetchInterval: live ? LIVE_COLLAB_REFETCH_MS : false,
    refetchOnWindowFocus: live,
  });
}
