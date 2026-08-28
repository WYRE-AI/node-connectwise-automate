/**
 * Pagination utilities for the ConnectWise Automate API
 *
 * ConnectWise Automate uses offset-based pagination with page and pageSize parameters.
 */

import type { HttpClient } from './http.js';
import { normalizeListResponse } from './types/common.js';

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Number of records per page (default: 100) */
  pageSize?: number;
  /** Page number (1-indexed, default: 1) */
  page?: number;
}

/**
 * Paginated response structure from ConnectWise Automate
 */
export interface PaginatedResponse<T> {
  /** Total number of records */
  TotalRecords?: number;
  /** The data array */
  Data: T[];
}

/**
 * Async iterable wrapper for paginated results
 */
export class PaginatedIterable<T> implements AsyncIterable<T> {
  private readonly httpClient: HttpClient;
  private readonly path: string;
  private readonly params: Record<string, string | number | boolean | undefined>;
  private readonly pageSize: number;

  constructor(
    httpClient: HttpClient,
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
    pageSize: number = 100
  ) {
    this.httpClient = httpClient;
    this.path = path;
    this.params = params;
    this.pageSize = pageSize;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let page = 1;
    let totalRecords: number | null = null;
    let fetchedRecords = 0;

    while (true) {
      // Fetch the current page. The live API returns list endpoints as a
      // bare array rather than the documented { Data, TotalRecords }
      // envelope (issue #38) — normalize either shape.
      const raw = await this.httpClient.request<PaginatedResponse<T> | T[]>(this.path, {
        params: {
          ...this.params,
          pageSize: this.pageSize,
          page,
        },
      });
      const response = normalizeListResponse(raw);

      // Get total record count on first page
      if (totalRecords === null) {
        totalRecords = response.TotalRecords ?? 0;
      }

      // Get items from the response
      const items = response.Data;
      if (!items || items.length === 0) {
        break;
      }

      // Yield each item
      for (const item of items) {
        yield item;
        fetchedRecords++;
      }

      // Check if we've fetched all records
      if (totalRecords > 0 && fetchedRecords >= totalRecords) {
        break;
      }

      // If we got fewer items than page size, we're done
      if (items.length < this.pageSize) {
        break;
      }

      // Move to next page
      page++;
    }
  }

  /**
   * Collect all items into an array
   */
  async toArray(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }
}

/**
 * Build pagination query parameters
 */
export function buildPaginationParams(params?: PaginationParams): Record<string, number | undefined> {
  if (!params) {
    return {};
  }
  return {
    pageSize: params.pageSize,
    page: params.page,
  };
}

/**
 * Create a paginated iterable for a resource
 */
export function createPaginatedIterable<T>(
  httpClient: HttpClient,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  pageSize?: number
): PaginatedIterable<T> {
  return new PaginatedIterable<T>(httpClient, path, params, pageSize);
}
