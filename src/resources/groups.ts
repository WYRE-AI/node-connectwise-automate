/**
 * Groups resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type {
  Group,
  GroupListParams,
  GroupListResponse,
  GroupMember,
  GroupMemberListParams,
  GroupMemberListResponse,
  GroupAddMembersRequest,
  GroupRemoveMembersRequest,
} from '../types/groups.js';

/**
 * Groups resource operations
 */
export class GroupsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List groups with optional filtering
   */
  async list(params?: GroupListParams): Promise<GroupListResponse> {
    return this.httpClient.request<GroupListResponse>('/Groups', {
      params: this.buildListParams(params),
    });
  }

  /**
   * List all groups with automatic pagination
   */
  listAll(params?: Omit<GroupListParams, 'pageSize' | 'page'>): PaginatedIterable<Group> {
    return createPaginatedIterable<Group>(
      this.httpClient,
      '/Groups',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single group by ID
   */
  async get(id: number): Promise<Group> {
    return this.httpClient.request<Group>(`/Groups/${id}`);
  }

  /**
   * List members of a group
   */
  async members(groupId: number, params?: GroupMemberListParams): Promise<GroupMemberListResponse> {
    return this.httpClient.request<GroupMemberListResponse>(`/Groups/${groupId}/Members`, {
      params: this.buildMemberListParams(params),
    });
  }

  /**
   * List all members of a group with automatic pagination
   */
  membersAll(groupId: number, params?: Omit<GroupMemberListParams, 'pageSize' | 'page'>): PaginatedIterable<GroupMember> {
    return createPaginatedIterable<GroupMember>(
      this.httpClient,
      `/Groups/${groupId}/Members`,
      this.buildMemberListParams(params)
    );
  }

  /**
   * Add members to a group
   */
  async addMembers(groupId: number, request: GroupAddMembersRequest): Promise<void> {
    await this.httpClient.request<void>(`/Groups/${groupId}/Members`, {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Remove members from a group
   */
  async removeMembers(groupId: number, request: GroupRemoveMembersRequest): Promise<void> {
    await this.httpClient.request<void>(`/Groups/${groupId}/Members`, {
      method: 'DELETE',
      body: request,
    });
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(params?: GroupListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.groupType !== undefined) result['groupType'] = params.groupType;
    if (params.parentId !== undefined) result['parentId'] = params.parentId;
    if (params.name !== undefined) result['name'] = params.name;

    return result;
  }

  /**
   * Build query parameters from member list params
   */
  private buildMemberListParams(params?: GroupMemberListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.groupId !== undefined) result['groupId'] = params.groupId;
    if (params.memberType !== undefined) result['memberType'] = params.memberType;

    return result;
  }
}
