/**
 * Patches resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type {
  Patch,
  PatchListParams,
  PatchListResponse,
  PatchApproveRequest,
  PatchApproveResult,
  ComputerPatch,
  ComputerPatchListParams,
  ComputerPatchListResponse,
  PatchStatistics,
  PatchInstallRequest,
  PatchInstallResponse,
} from '../types/patches.js';

/**
 * Patches resource operations
 */
export class PatchesResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List patches with optional filtering
   */
  async list(params?: PatchListParams): Promise<PatchListResponse> {
    return this.httpClient.request<PatchListResponse>('/Patches', {
      params: this.buildListParams(params),
    });
  }

  /**
   * List all patches with automatic pagination
   */
  listAll(params?: Omit<PatchListParams, 'pageSize' | 'page'>): PaginatedIterable<Patch> {
    return createPaginatedIterable<Patch>(
      this.httpClient,
      '/Patches',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single patch by ID
   */
  async get(id: number): Promise<Patch> {
    return this.httpClient.request<Patch>(`/Patches/${id}`);
  }

  /**
   * Approve one or more patches
   */
  async approve(request: PatchApproveRequest): Promise<PatchApproveResult> {
    return this.httpClient.request<PatchApproveResult>('/Patches/Approve', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Deny (unapprove) one or more patches
   */
  async deny(request: PatchApproveRequest): Promise<PatchApproveResult> {
    return this.httpClient.request<PatchApproveResult>('/Patches/Deny', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Install patches on computers
   */
  async install(request: PatchInstallRequest): Promise<PatchInstallResponse> {
    return this.httpClient.request<PatchInstallResponse>('/Patches/Install', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Get patch statistics
   */
  async statistics(): Promise<PatchStatistics> {
    return this.httpClient.request<PatchStatistics>('/Patches/Statistics');
  }

  /**
   * List computer patch status
   */
  async computerPatches(params?: ComputerPatchListParams): Promise<ComputerPatchListResponse> {
    return this.httpClient.request<ComputerPatchListResponse>('/Patches/ComputerPatches', {
      params: this.buildComputerPatchListParams(params),
    });
  }

  /**
   * List all computer patches with automatic pagination
   */
  computerPatchesAll(params?: Omit<ComputerPatchListParams, 'pageSize' | 'page'>): PaginatedIterable<ComputerPatch> {
    return createPaginatedIterable<ComputerPatch>(
      this.httpClient,
      '/Patches/ComputerPatches',
      this.buildComputerPatchListParams(params)
    );
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(params?: PatchListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.isApproved !== undefined) result['isApproved'] = params.isApproved;
    if (params.category !== undefined) result['category'] = params.category;
    if (params.severity !== undefined) result['severity'] = params.severity;
    if (params.product !== undefined) result['product'] = params.product;
    if (params.title !== undefined) result['title'] = params.title;
    if (params.releaseDateStart !== undefined) result['releaseDateStart'] = params.releaseDateStart;
    if (params.releaseDateEnd !== undefined) result['releaseDateEnd'] = params.releaseDateEnd;

    return result;
  }

  /**
   * Build query parameters from computer patch list params
   */
  private buildComputerPatchListParams(params?: ComputerPatchListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.computerId !== undefined) result['computerId'] = params.computerId;
    if (params.patchId !== undefined) result['patchId'] = params.patchId;
    if (params.status !== undefined) result['status'] = params.status;
    if (params.clientId !== undefined) result['clientId'] = params.clientId;

    return result;
  }
}
