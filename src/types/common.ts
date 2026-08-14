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
