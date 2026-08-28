/**
 * Contacts resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import { normalizeListResponse } from '../types/common.js';
import type {
  Contact,
  ContactListParams,
  ContactListResponse,
  ContactCreateData,
  ContactUpdateData,
} from '../types/contacts.js';

/**
 * Contacts resource operations
 */
export class ContactsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List contacts with optional filtering
   */
  async list(params?: ContactListParams): Promise<ContactListResponse> {
    const response = await this.httpClient.request<ContactListResponse | Contact[]>('/Contacts', {
      params: this.buildListParams(params),
    });
    return normalizeListResponse(response);
  }

  /**
   * List all contacts with automatic pagination
   */
  listAll(params?: Omit<ContactListParams, 'pageSize' | 'page'>): PaginatedIterable<Contact> {
    return createPaginatedIterable<Contact>(
      this.httpClient,
      '/Contacts',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single contact by ID
   */
  async get(id: number): Promise<Contact> {
    return this.httpClient.request<Contact>(`/Contacts/${id}`);
  }

  /**
   * Create a new contact
   */
  async create(data: ContactCreateData): Promise<Contact> {
    return this.httpClient.request<Contact>('/Contacts', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update an existing contact
   */
  async update(id: number, data: ContactUpdateData): Promise<Contact> {
    return this.httpClient.request<Contact>(`/Contacts/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /**
   * Delete a contact
   */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Contacts/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(params?: ContactListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.clientId !== undefined) result['clientId'] = params.clientId;
    if (params.locationId !== undefined) result['locationId'] = params.locationId;
    if (params.email !== undefined) result['email'] = params.email;

    return result;
  }
}
