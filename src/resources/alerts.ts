/**
 * Alerts resource operations
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type {
  Alert,
  AlertListParams,
  AlertListResponse,
  AlertAcknowledgeData,
  AlertAcknowledgeResult,
  AlertCloseData,
  AlertStatistics,
} from '../types/alerts.js';

/**
 * Alerts resource operations
 */
export class AlertsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List alerts with optional filtering
   */
  async list(params?: AlertListParams): Promise<AlertListResponse> {
    return this.httpClient.request<AlertListResponse>('/Alerts', {
      params: this.buildListParams(params),
    });
  }

  /**
   * List all alerts with automatic pagination
   */
  listAll(params?: Omit<AlertListParams, 'pageSize' | 'page'>): PaginatedIterable<Alert> {
    return createPaginatedIterable<Alert>(
      this.httpClient,
      '/Alerts',
      this.buildListParams(params)
    );
  }

  /**
   * Get a single alert by ID
   */
  async get(id: number): Promise<Alert> {
    return this.httpClient.request<Alert>(`/Alerts/${id}`);
  }

  /**
   * Acknowledge one or more alerts
   */
  async acknowledge(data: AlertAcknowledgeData): Promise<AlertAcknowledgeResult> {
    return this.httpClient.request<AlertAcknowledgeResult>('/Alerts/Acknowledge', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Close one or more alerts
   */
  async close(data: AlertCloseData): Promise<AlertAcknowledgeResult> {
    return this.httpClient.request<AlertAcknowledgeResult>('/Alerts/Close', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Get alert statistics
   */
  async statistics(params?: Pick<AlertListParams, 'clientId' | 'locationId'>): Promise<AlertStatistics> {
    return this.httpClient.request<AlertStatistics>('/Alerts/Statistics', {
      params: params,
    });
  }

  /**
   * Build query parameters from list params
   */
  private buildListParams(params?: AlertListParams): Record<string, string | number | boolean | undefined> {
    if (!params) return {};

    const result: Record<string, string | number | boolean | undefined> = {};

    if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
    if (params.page !== undefined) result['page'] = params.page;
    if (params.condition !== undefined) result['condition'] = params.condition;
    if (params.includeFields !== undefined) result['includeFields'] = params.includeFields;
    if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
    if (params.expand !== undefined) result['expand'] = params.expand;
    if (params.computerId !== undefined) result['computerId'] = params.computerId;
    if (params.clientId !== undefined) result['clientId'] = params.clientId;
    if (params.locationId !== undefined) result['locationId'] = params.locationId;
    if (params.severity !== undefined) result['severity'] = params.severity;
    if (params.status !== undefined) result['status'] = params.status;
    if (params.isAcknowledged !== undefined) result['isAcknowledged'] = params.isAcknowledged;
    if (params.startDate !== undefined) result['startDate'] = params.startDate;
    if (params.endDate !== undefined) result['endDate'] = params.endDate;

    return result;
  }
}
