/**
 * Clients resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type {
  Client,
  ClientListParams,
  ClientListResponse,
  ClientCreateData,
  ClientUpdateData,
  Location,
  LocationListParams,
  LocationListResponse,
  LocationCreateData,
  LocationUpdateData,
} from '../types/clients.js';

/**
 * Clients resource operations
 */
export class ClientsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List clients with optional filtering
   */
  async list(params?: ClientListParams): Promise<ClientListResponse> {
    return this.httpClient.request<ClientListResponse>('/Clients', {
      params: this.buildListParams(params),
    });
  }

  /**
   * List all clients with automatic pagination
   */
  listAll(params?: Omit<ClientListParams, 'pageSize' | 'page'>): PaginatedIterable<Client> {
    return createPaginatedIterable<Client>(
      this.httpClient,
      '/Clients',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single client by ID
   */
  async get(id: number): Promise<Client> {
    return this.httpClient.request<Client>(`/Clients/${id}`);
  }

  /**
   * Create a new client
   */
  async create(data: ClientCreateData): Promise<Client> {
    return this.httpClient.request<Client>('/Clients', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update an existing client
   */
  async update(id: number, data: ClientUpdateData): Promise<Client> {
    return this.httpClient.request<Client>(`/Clients/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /**
   * Delete a client
   */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Clients/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(params?: ClientListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.includeInactive !== undefined) result['includeInactive'] = params.includeInactive;
    if (params.name !== undefined) result['name'] = params.name;

    return result;
  }
}

/**
 * Locations resource operations
 */
export class LocationsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List locations with optional filtering
   */
  async list(params?: LocationListParams): Promise<LocationListResponse> {
    return this.httpClient.request<LocationListResponse>('/Locations', {
      params: this.buildListParams(params),
    });
  }

  /**
   * List all locations with automatic pagination
   */
  listAll(params?: Omit<LocationListParams, 'pageSize' | 'page'>): PaginatedIterable<Location> {
    return createPaginatedIterable<Location>(
      this.httpClient,
      '/Locations',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single location by ID
   */
  async get(id: number): Promise<Location> {
    return this.httpClient.request<Location>(`/Locations/${id}`);
  }

  /**
   * Create a new location
   */
  async create(data: LocationCreateData): Promise<Location> {
    return this.httpClient.request<Location>('/Locations', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update an existing location
   */
  async update(id: number, data: LocationUpdateData): Promise<Location> {
    return this.httpClient.request<Location>(`/Locations/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /**
   * Delete a location
   */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Locations/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(params?: LocationListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.clientId !== undefined) result['clientId'] = params.clientId;

    return result;
  }
}
