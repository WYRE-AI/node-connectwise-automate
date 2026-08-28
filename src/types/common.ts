/**
 * Common types shared across resources
 */

/**
 * Base list parameters for paginated endpoints
 */
export interface BaseListParams {
  /** Number of records per page (default: 100) */
  pageSize?: number;
  /** Page number (1-indexed, default: 1) */
  page?: number;
  /** Automate filter expression, e.g. `ComputerName like '%web%'` */
  condition?: string;
  /** Comma-separated fields to include in the response */
  includeFields?: string;
  /** Comma-separated fields to omit from the response */
  excludeFields?: string;
  /** Sort field and direction */
  orderBy?: string;
  /** Expand related entities */
  expand?: string;
  /** Comma-separated list of ids to fetch */
  ids?: string;
}

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  Id: number;
}

/**
 * Response wrapper for list endpoints
 */
export interface ListResponse<T> {
  TotalRecords?: number;
  Data: T[];
}

/**
 * Normalize a list-endpoint response into the documented `{ Data,
 * TotalRecords }` envelope.
 *
 * The live ConnectWise Automate REST API returns list endpoints (e.g.
 * `/Computers`, `/Clients`) as a **bare JSON array**, even though this
 * library's response types model them as `{ Data, TotalRecords }`. Because
 * the HTTP layer does an unchecked `response.json() as T` cast, that
 * mismatch previously surfaced only at runtime as `response.Data` being
 * `undefined` for every consumer (issue #38). Accept either shape here so
 * a live-API/type mismatch can't silently produce `undefined` where
 * callers expect an array.
 */
export function normalizeListResponse<T>(response: T[] | ListResponse<T>): ListResponse<T> {
  if (Array.isArray(response)) {
    return { Data: response };
  }
  return response;
}

/**
 * Extra data fields for computers
 */
export interface ExtraDataField {
  Id: number;
  FieldName: string;
  FieldValue: string;
}

/**
 * Location information
 */
export interface LocationInfo {
  Id: number;
  Name: string;
  ClientId: number;
}

/**
 * Generic API response
 */
export interface ApiResponse<T> {
  Data: T;
  Success: boolean;
  Message?: string;
}
