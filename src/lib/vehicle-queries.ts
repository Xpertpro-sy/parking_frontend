import { useQuery } from "@tanstack/react-query";
import { getVehicleByIdRequest, listVehiclesRequest } from "@/lib/vehicle-api";

export const vehicleQueryKeys = {
  all: ["vehicles"] as const,
  list: () => [...vehicleQueryKeys.all, "list"] as const,
  detail: (id: string) => [...vehicleQueryKeys.all, "detail", id] as const,
};

const VEHICLE_STALE_TIME_MS = 3 * 60 * 1000;
const VEHICLE_GC_TIME_MS = 10 * 60 * 1000;

export function useVehiclesQuery() {
  return useQuery({
    queryKey: vehicleQueryKeys.list(),
    queryFn: listVehiclesRequest,
    staleTime: VEHICLE_STALE_TIME_MS,
    gcTime: VEHICLE_GC_TIME_MS,
  });
}

export function useVehicleDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: vehicleQueryKeys.detail(id ?? ""),
    queryFn: () => getVehicleByIdRequest(id ?? ""),
    enabled: Boolean(id),
    staleTime: VEHICLE_STALE_TIME_MS,
    gcTime: VEHICLE_GC_TIME_MS,
  });
}
