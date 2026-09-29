import { calculateDeliveryFee, type DeliveryFeeSettings, type GeoPoint, type OperationalOrder } from "@/lib/operations";

export type DeliveryRouteStop = {
  order: OperationalOrder;
  distanceKm: number;
  fee: number;
};

export function distanceBetweenKm(from: GeoPoint, to: GeoPoint) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getDeliveryDistance(order: OperationalOrder, origin: GeoPoint) {
  if (Number.isFinite(order.latitude) && Number.isFinite(order.longitude)) {
    return distanceBetweenKm(origin, { latitude: order.latitude!, longitude: order.longitude! });
  }
  return Math.max(0, order.distanceKm);
}

function normalizeNeighborhood(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function optimizeDeliveryRoute(orders: OperationalOrder[], origin: GeoPoint, feeSettings?: DeliveryFeeSettings): DeliveryRouteStop[] {
  const grouped = new Map<string, OperationalOrder[]>();
  for (const order of orders) {
    const key = normalizeNeighborhood(order.neighborhood || order.postalCode || "Sem bairro");
    grouped.set(key, [...(grouped.get(key) ?? []), order]);
  }

  let current = origin;
  const remainingGroups = [...grouped.values()];
  const route: DeliveryRouteStop[] = [];

  while (remainingGroups.length) {
    let nearestGroupIndex = 0;
    let nearestGroupDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remainingGroups.length; index += 1) {
      const group = remainingGroups[index]!;
      const geocoded = group.filter((order) => Number.isFinite(order.latitude) && Number.isFinite(order.longitude));
      const target = geocoded.length
        ? {
            latitude: geocoded.reduce((sum, order) => sum + order.latitude!, 0) / geocoded.length,
            longitude: geocoded.reduce((sum, order) => sum + order.longitude!, 0) / geocoded.length,
          }
        : current;
      const distance = geocoded.length ? distanceBetweenKm(current, target) : Math.min(...group.map((order) => order.distanceKm));
      if (distance < nearestGroupDistance) {
        nearestGroupDistance = distance;
        nearestGroupIndex = index;
      }
    }

    const [group] = remainingGroups.splice(nearestGroupIndex, 1);
    const sortedGroup = [...group!].sort((left, right) => getDeliveryDistance(left, current) - getDeliveryDistance(right, current));
    for (const order of sortedGroup) {
      const distanceKm = getDeliveryDistance(order, origin);
      route.push({ order, distanceKm, fee: calculateDeliveryFee(order.neighborhood, distanceKm, feeSettings) });
      if (Number.isFinite(order.latitude) && Number.isFinite(order.longitude)) {
        current = { latitude: order.latitude!, longitude: order.longitude! };
      }
    }
  }

  return route;
}

export async function geocodeBrazilPostalCode(postalCode: string): Promise<GeoPoint | null> {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ postalcode: digits, country: "Brazil", format: "jsonv2", limit: "1" }).toString();
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const results = await response.json() as { lat?: string; lon?: string }[];
    const latitude = Number(results[0]?.lat);
    const longitude = Number(results[0]?.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}
