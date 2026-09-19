// Barrel for the data layer, split by domain:
// - rooms.ts        room inventory CRUD
// - availability.ts bed math over a date range
// - requests.ts     request lifecycle (create, decide, edit, cancel)
// - blueprint.ts    the singleton floorplan row
// - shared.ts       request query building and date attachment
// - capacity.ts     race-safe bed capacity checks
//
// Keeps existing `@/lib/data` imports working unchanged.

export type { RequestWithDetails, Tx } from "./shared";
export { toRoomInfo, getRooms, upsertRoom, deleteRoom } from "./rooms";
export { availabilityFromBookings, getAvailabilityRange } from "./availability";
export type { DecideResult, GroupDecisionRoomResult } from "./requests";
export {
  getRequestsAll,
  getRequestById,
  getGroupRequests,
  getRequestByCancelToken,
  getGroupByCancelToken,
  cancelByToken,
  createRequest,
  decideGroup,
  updateRequestAsAdmin,
  deleteRequestAsAdmin,
} from "./requests";
export { getBlueprintRow, saveBlueprint } from "./blueprint";
