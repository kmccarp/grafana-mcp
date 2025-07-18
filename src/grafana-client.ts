import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface GrafanaConfig {
  baseUrl: string;
  authToken?: string;
  sessionCookie?: string;
}

export class GrafanaClient {
  private client: AxiosInstance;
  private config: GrafanaConfig;
  private sessionCookie: string | null = null;

  constructor(config?: GrafanaConfig) {
    this.config = config || {
      baseUrl: process.env.GRAFANA_BASE_URL || 'http://localhost:3000',
      authToken: process.env.GRAFANA_AUTH_TOKEN,
      sessionCookie: process.env.GRAFANA_SESSION_COOKIE,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupAuth();
  }

  private setupAuth() {
    if (this.config.authToken) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.config.authToken}`;
    } else if (this.sessionCookie || this.config.sessionCookie) {
      const cookie = this.sessionCookie || this.config.sessionCookie;
      this.client.defaults.headers.common['Cookie'] = cookie?.startsWith('grafana_session=') ? cookie : `grafana_session=${cookie}`;
    }

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const responseData = error.response?.data;
        const url = error.config?.url;
        const method = error.config?.method?.toUpperCase();
        
        let errorMessage = `HTTP ${status} ${statusText}`;
        
        if (status === 401) {
          errorMessage = 'Authentication failed. Please use the login tool to authenticate again.';
        } else if (status === 403) {
          errorMessage = 'Access denied. You may not have permission to access this resource.';
        } else if (status === 400) {
          errorMessage = `Bad Request (400): ${method} ${url}`;
          if (responseData) {
            if (typeof responseData === 'string') {
              errorMessage += `\nResponse: ${responseData}`;
            } else if (typeof responseData === 'object') {
              if (responseData.message) {
                errorMessage += `\nMessage: ${responseData.message}`;
              }
              if (responseData.error) {
                errorMessage += `\nError: ${responseData.error}`;
              }
              if (responseData.details) {
                errorMessage += `\nDetails: ${JSON.stringify(responseData.details)}`;
              }
              // Include full response data for debugging
              errorMessage += `\nFull Response: ${JSON.stringify(responseData, null, 2)}`;
            }
          }
        } else if (status === 404) {
          errorMessage = `Not Found (404): ${method} ${url}`;
        } else if (status >= 500) {
          errorMessage = `Server Error (${status}): ${method} ${url}`;
          if (responseData) {
            errorMessage += `\nResponse: ${JSON.stringify(responseData)}`;
          }
        } else if (status) {
          errorMessage = `HTTP ${status} ${statusText}: ${method} ${url}`;
          if (responseData) {
            errorMessage += `\nResponse: ${JSON.stringify(responseData)}`;
          }
        }
        
        // Include original error for debugging
        if (error.message && !errorMessage.includes(error.message)) {
          errorMessage += `\nOriginal Error: ${error.message}`;
        }
        
        const enhancedError = new Error(errorMessage);
        enhancedError.name = error.name;
        throw enhancedError;
      }
    );
  }

  private isAuthenticated(): boolean {
    return !!(this.config.authToken || this.sessionCookie || this.config.sessionCookie);
  }

  private getAuthenticationMessage(): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `🔐 Authentication Required

To use this tool, you need to authenticate with Grafana first.

Please follow these steps:
1. Use the 'login' tool to get the Grafana login URL
2. Log in with your Google Workspace account
3. Extract your session cookie using the browser developer tools
4. Use the 'set_session_cookie' tool with your cookie value

Alternatively, you can set the GRAFANA_AUTH_TOKEN or GRAFANA_SESSION_COOKIE environment variables.

Use the 'test_authentication' tool to verify your authentication status.`
        }
      ]
    };
  }

  async queryDashboard(uid: string, includeData: boolean = false): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const response = await this.client.get(`/api/dashboards/uid/${uid}`);
      const dashboard = response.data.dashboard;

      let content = `Dashboard: ${dashboard.title}\n`;
      content += `UID: ${dashboard.uid}\n`;
      content += `Tags: ${dashboard.tags?.join(', ') || 'None'}\n`;
      content += `Panels: ${dashboard.panels?.length || 0}\n\n`;

      if (dashboard.panels) {
        content += 'Panel Summary:\n';
        dashboard.panels.forEach((panel: any, index: number) => {
          content += `${index + 1}. ${panel.title || 'Untitled'} (ID: ${panel.id}, Type: ${panel.type})\n`;
        });
      }

      if (includeData && dashboard.panels) {
        content += '\nDetailed Panel Information:\n';
        dashboard.panels.forEach((panel: any) => {
          content += `\nPanel: ${panel.title || 'Untitled'} (ID: ${panel.id})\n`;
          content += `Type: ${panel.type}\n`;
          if (panel.targets) {
            content += `Queries: ${panel.targets.length}\n`;
            panel.targets.forEach((target: any, idx: number) => {
              content += `  Query ${idx + 1}: ${target.expr || target.query || 'N/A'}\n`;
            });
          }
        });
      }

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to query dashboard: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async searchDashboards(query?: string, tag?: string, limit: number = 10): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const params: any = { limit };
      if (query) params.query = query;
      if (tag) params.tag = tag;

      const response = await this.client.get('/api/search', { params });
      const dashboards = response.data;

      let content = `Found ${dashboards.length} dashboard(s):\n\n`;
      
      dashboards.forEach((dashboard: any, index: number) => {
        content += `${index + 1}. ${dashboard.title}\n`;
        content += `   UID: ${dashboard.uid}\n`;
        content += `   URL: ${dashboard.url}\n`;
        if (dashboard.tags?.length > 0) {
          content += `   Tags: ${dashboard.tags.join(', ')}\n`;
        }
        content += '\n';
      });

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to search dashboards: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async queryPanelData(
    dashboardUid: string,
    panelId: number,
    from: string = 'now-1h',
    to: string = 'now'
  ): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const dashboard = await this.client.get(`/api/dashboards/uid/${dashboardUid}`);
      const panel = dashboard.data.dashboard.panels.find((p: any) => p.id === panelId);
      
      if (!panel) {
        throw new Error(`Panel with ID ${panelId} not found in dashboard ${dashboardUid}`);
      }

      if (!panel.targets || panel.targets.length === 0) {
        return {
          content: [{ type: 'text', text: `Panel "${panel.title}" has no data queries configured.` }],
        };
      }

      const queryPromises = panel.targets.map(async (target: any) => {
        const queryParams = {
          from,
          to,
          queries: [
            {
              ...target,
              refId: target.refId || 'A',
            },
          ],
        };

        try {
          const response = await this.client.post('/api/ds/query', queryParams);
          return response.data;
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      });

      const results = await Promise.all(queryPromises);
      
      let content = `Panel Data: ${panel.title} (ID: ${panelId})\n`;
      content += `Time Range: ${from} to ${to}\n\n`;

      results.forEach((result, index) => {
        content += `Query ${index + 1} Results:\n`;
        if (result.error) {
          content += `  Error: ${result.error}\n`;
        } else if (result.results) {
          Object.values(result.results).forEach((queryResult: any) => {
            if (queryResult.frames) {
              queryResult.frames.forEach((frame: any) => {
                content += `  Series: ${frame.name || 'Unnamed'}\n`;
                content += `  Fields: ${frame.schema?.fields?.length || 0}\n`;
                content += `  Data points: ${frame.data?.values?.[0]?.length || 0}\n`;
              });
            }
          });
        }
        content += '\n';
      });

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to query panel data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  async getDashboardPanels(dashboardUid: string): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const response = await this.client.get(`/api/dashboards/uid/${dashboardUid}`);
      const dashboard = response.data.dashboard;
      const panels = dashboard.panels || [];

      let content = `Dashboard: ${dashboard.title}\n`;
      content += `Total Panels: ${panels.length}\n\n`;

      panels.forEach((panel: any, index: number) => {
        content += `${index + 1}. ${panel.title || 'Untitled'}\n`;
        content += `   ID: ${panel.id}\n`;
        content += `   Type: ${panel.type}\n`;
        if (panel.description) {
          content += `   Description: ${panel.description}\n`;
        }
        if (panel.targets && panel.targets.length > 0) {
          content += `   Queries: ${panel.targets.length}\n`;
          panel.targets.forEach((target: any, idx: number) => {
            const query = target.expr || target.query || target.rawSql || 'N/A';
            content += `     ${idx + 1}. ${query}\n`;
          });
        }
        content += '\n';
      });

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard panels: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setServer(url: string): Promise<CallToolResult> {
    try {
      // Validate and clean URL
      if (!url || url.trim() === '') {
        return {
          content: [{ type: 'text', text: '❌ Error: Server URL cannot be empty' }],
        };
      }

      // Clean up URL - remove trailing slash and ensure it starts with http/https
      const cleanUrl = url.trim().replace(/\/$/, '');
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        return {
          content: [{ type: 'text', text: '❌ Error: URL must start with http:// or https://' }],
        };
      }

      // Update config
      this.config.baseUrl = cleanUrl;
      this.client.defaults.baseURL = cleanUrl;
      
      // Clear authentication since we're switching servers
      this.sessionCookie = null;
      delete this.client.defaults.headers.common['Cookie'];
      delete this.client.defaults.headers.common['Authorization'];
      
      let content = '✅ Grafana server updated successfully!\n\n';
      content += `New server: ${cleanUrl}\n\n`;
      content += '⚠️  Authentication has been cleared. You will need to:\n';
      content += '1. Use the login tool to get the login URL for the new server\n';
      content += '2. Log in and extract a new session cookie\n';
      content += '3. Use set_session_cookie with the new cookie\n\n';
      content += '💡 You can use test_authentication to verify the connection works.\n';

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `❌ Error setting server: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  }

  async getServerInfo(): Promise<CallToolResult> {
    let content = '🖥️  Grafana Server Information\n\n';
    content += `Current server: ${this.config.baseUrl}\n`;
    
    // Check authentication status
    const isAuth = this.isAuthenticated();
    content += `Authentication: ${isAuth ? '✅ Configured' : '❌ Not configured'}\n`;
    
    if (this.config.authToken) {
      content += `Auth method: Service Account Token\n`;
    } else if (this.sessionCookie) {
      content += `Auth method: Session Cookie (set via tool)\n`;
    } else if (this.config.sessionCookie) {
      content += `Auth method: Session Cookie (environment variable)\n`;
    } else {
      content += `Auth method: None\n`;
    }
    
    // Try to get server info if authenticated
    if (isAuth) {
      try {
        const response = await this.client.get('/api/health');
        content += `\n🟢 Server Status: ${response.data.database === 'ok' ? 'Healthy' : 'Issues detected'}\n`;
        
        try {
          const settingsResponse = await this.client.get('/api/frontend/settings');
          const settings = settingsResponse.data;
          if (settings.buildInfo) {
            content += `Grafana Version: ${settings.buildInfo.version}\n`;
            content += `Build: ${settings.buildInfo.commit} (${settings.buildInfo.env})\n`;
          }
        } catch (error) {
          content += `Version: Unable to retrieve\n`;
        }
        
      } catch (error) {
        content += `\n🔴 Server Status: Unable to connect\n`;
        content += `Error: ${error instanceof Error ? error.message : String(error)}\n`;
      }
    } else {
      content += `\n⚠️  Cannot check server status without authentication\n`;
    }
    
    content += `\n💡 Use 'set_server' to change servers or 'login' to authenticate\n`;
    
    return {
      content: [{ type: 'text', text: content }],
    };
  }

  async getLoginUrl(): Promise<CallToolResult> {
    const loginUrl = `${this.config.baseUrl}/login`;
    
    let content = '🔐 Grafana Authentication\n\n';
    content += `Current server: ${this.config.baseUrl}\n\n`;
    content += '1. Click this link to open Grafana in your browser:\n';
    content += `   ${loginUrl}\n\n`;
    content += '2. Log in with your credentials\n\n';
    content += '3. After logging in, open Developer Tools (F12)\n';
    content += '4. Go to Application/Storage tab → Cookies\n';
    content += '5. Find the "grafana_session" cookie and copy its value\n';
    content += '6. Come back here and use the set_session_cookie tool with that value\n\n';
    content += '💡 The cookie value will be a long string starting with something like "eyJrI..."\n';
    content += 'You only need the value, not the "grafana_session=" part.\n';

    return {
      content: [{ type: 'text', text: content }],
    };
  }

  async setSessionCookie(cookie: string): Promise<CallToolResult> {
    if (!cookie || cookie.trim() === '') {
      return {
        content: [{ type: 'text', text: '❌ Error: Cookie value cannot be empty' }],
      };
    }

    // Clean up the cookie value
    const cleanCookie = cookie.replace(/^grafana_session=/, '').trim();
    this.sessionCookie = cleanCookie;
    
    // Update the client headers
    this.client.defaults.headers.common['Cookie'] = `grafana_session=${cleanCookie}`;
    
    // Test the authentication immediately
    try {
      const response = await this.client.get('/api/user');
      const user = response.data;

      let content = '✅ Authentication successful!\n\n';
      content += `Welcome, ${user.name || user.login}!\n`;
      content += `Email: ${user.email || 'N/A'}\n`;
      content += `Role: ${user.orgRole || 'N/A'}\n\n`;
      content += '🎉 You can now use all the Grafana tools to query dashboards and metrics.\n';

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      this.sessionCookie = null;
      delete this.client.defaults.headers.common['Cookie'];
      
      let content = '❌ Authentication failed!\n\n';
      content += 'The session cookie you provided is invalid or expired.\n';
      content += 'Please use the login tool to get a fresh session cookie.\n\n';
      content += 'Common issues:\n';
      content += '- Make sure you copied the entire cookie value\n';
      content += '- The session may have expired\n';
      content += '- You may need to log in again\n';

      return {
        content: [{ type: 'text', text: content }],
      };
    }
  }

  async testAuthentication(): Promise<CallToolResult> {
    try {
      const response = await this.client.get('/api/user');
      const user = response.data;

      let content = '✅ Authentication Successful!\n\n';
      content += `Logged in as: ${user.name || user.login}\n`;
      content += `Email: ${user.email || 'N/A'}\n`;
      content += `Role: ${user.orgRole || 'N/A'}\n`;
      content += `Organization: ${user.orgName || 'N/A'}\n`;

      if (this.config.authToken) {
        content += '\nUsing: Service Account Token\n';
      } else if (this.sessionCookie) {
        content += '\nUsing: Session Cookie (set via tool)\n';
      } else if (this.config.sessionCookie) {
        content += '\nUsing: Session Cookie (environment variable)\n';
      } else {
        content += '\nUsing: Unknown authentication method\n';
      }

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error: any) {
      let content = '❌ Authentication Failed!\n\n';
      
      if (error.response?.status === 401) {
        content += 'Error: Invalid credentials or expired session\n';
        content += 'Please check your GRAFANA_AUTH_TOKEN or GRAFANA_SESSION_COOKIE\n';
      } else if (error.response?.status === 403) {
        content += 'Error: Access denied\n';
        content += 'Your account may not have sufficient permissions\n';
      } else {
        content += `Error: ${error instanceof Error ? error.message : String(error)}\n`;
      }

      content += '\nTroubleshooting:\n';
      content += '1. Use the login tool to get a fresh session cookie\n';
      content += '2. Verify your Grafana URL is correct\n';
      content += '3. Check if your credentials are still valid\n';
      content += '4. Ensure you have at least Viewer role in Grafana\n';

      return {
        content: [{ type: 'text', text: content }],
      };
    }
  }

  async listDatasources(): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const response = await this.client.get('/api/datasources');
      const datasources = response.data;

      let content = `Available Datasources:\n\n`;
      content += `Total: ${datasources.length} datasources\n\n`;

      const prometheusDatasources = datasources.filter((ds: any) => ds.type === 'prometheus');
      if (prometheusDatasources.length > 0) {
        content += `Prometheus Datasources (${prometheusDatasources.length}):\n`;
        prometheusDatasources.forEach((ds: any) => {
          content += `  • ${ds.name} (ID: ${ds.id}, UID: ${ds.uid})\n`;
          content += `    URL: ${ds.url}\n`;
          content += `    Default: ${ds.isDefault ? 'Yes' : 'No'}\n\n`;
        });
      }

      const otherDatasources = datasources.filter((ds: any) => ds.type !== 'prometheus');
      if (otherDatasources.length > 0) {
        content += `Other Datasources (${otherDatasources.length}):\n`;
        otherDatasources.forEach((ds: any) => {
          content += `  • ${ds.name} (${ds.type}) - ID: ${ds.id}, UID: ${ds.uid}\n`;
        });
      }

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to list datasources: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getPrometheusDatasourceId(datasourceId?: string): Promise<string> {
    if (datasourceId) {
      return datasourceId;
    }

    try {
      const response = await this.client.get('/api/datasources');
      const datasources = response.data;
      
      // Find default Prometheus datasource first
      const defaultPrometheus = datasources.find((ds: any) => ds.type === 'prometheus' && ds.isDefault);
      if (defaultPrometheus) {
        return defaultPrometheus.id.toString();
      }
      
      // Fallback to first Prometheus datasource
      const firstPrometheus = datasources.find((ds: any) => ds.type === 'prometheus');
      if (firstPrometheus) {
        return firstPrometheus.id.toString();
      }
      
      throw new Error('No Prometheus datasource found');
    } catch (error) {
      throw new Error(`Failed to find Prometheus datasource: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAvailableMetrics(search?: string, datasourceId?: string): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const dsId = await this.getPrometheusDatasourceId(datasourceId);
      const response = await this.client.get(`/api/datasources/proxy/${dsId}/api/v1/label/__name__/values`);
      const metrics = response.data.data;

      let filteredMetrics = metrics;
      if (search) {
        const searchTerm = search.toLowerCase();
        filteredMetrics = metrics.filter((metric: string) => 
          metric.toLowerCase().includes(searchTerm)
        );
      }

      let content = `Available Metrics${search ? ` (filtered by "${search}")` : ''}:\n\n`;
      content += `Total: ${filteredMetrics.length}${search ? ` (of ${metrics.length})` : ''} metrics\n\n`;

      if (filteredMetrics.length === 0) {
        content += 'No metrics found matching your search criteria.\n';
      } else if (filteredMetrics.length > 50) {
        content += 'First 50 metrics:\n';
        filteredMetrics.slice(0, 50).forEach((metric: string, index: number) => {
          content += `${index + 1}. ${metric}\n`;
        });
        content += `\n... and ${filteredMetrics.length - 50} more metrics.\n`;
        content += 'Use a more specific search term to narrow down the results.\n';
      } else {
        filteredMetrics.forEach((metric: string, index: number) => {
          content += `${index + 1}. ${metric}\n`;
        });
      }

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to get available metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTagsForMetric(metricName: string, datasourceId?: string): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const dsId = await this.getPrometheusDatasourceId(datasourceId);
      const response = await this.client.get(`/api/datasources/proxy/${dsId}/api/v1/series?match[]=${metricName}`);
      const series = response.data.data;

      if (series.length === 0) {
        return {
          content: [{ type: 'text', text: `No data found for metric: ${metricName}\n\nThis could mean:\n- The metric name is incorrect\n- The metric has no recent data\n- You may need to use a different time range` }],
        };
      }

      // Extract all unique labels from all series
      const allLabels = new Set<string>();
      const labelValues: { [key: string]: Set<string> } = {};

      series.forEach((seriesData: any) => {
        Object.keys(seriesData).forEach(label => {
          allLabels.add(label);
          if (!labelValues[label]) {
            labelValues[label] = new Set();
          }
          labelValues[label].add(seriesData[label]);
        });
      });

      const sortedLabels = Array.from(allLabels).sort();

      let content = `Tags for metric: ${metricName}\n\n`;
      content += `Total series: ${series.length}\n`;
      content += `Available labels: ${sortedLabels.length}\n\n`;

      sortedLabels.forEach(label => {
        const values = Array.from(labelValues[label]).sort();
        content += `${label}:\n`;
        if (values.length > 20) {
          content += `  ${values.slice(0, 20).join(', ')}\n`;
          content += `  ... and ${values.length - 20} more values\n`;
        } else {
          content += `  ${values.join(', ')}\n`;
        }
        content += '\n';
      });

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to get tags for metric: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async executePromQL(query: string, from: string = 'now-1h', to: string = 'now', datasourceId?: string): Promise<CallToolResult> {
    if (!this.isAuthenticated()) {
      return this.getAuthenticationMessage();
    }
    
    try {
      const dsId = await this.getPrometheusDatasourceId(datasourceId);
      const params = new URLSearchParams({
        query: query,
        start: from,
        end: to,
        step: '15s'
      });

      const response = await this.client.get(`/api/datasources/proxy/${dsId}/api/v1/query_range?${params}`);
      const data = response.data.data;

      let content = `PromQL Query: ${query}\n`;
      content += `Time Range: ${from} to ${to}\n\n`;

      if (data.resultType === 'matrix') {
        content += `Result Type: Time Series\n`;
        content += `Series Count: ${data.result.length}\n\n`;

        if (data.result.length === 0) {
          content += 'No data returned for this query.\n';
        } else {
          data.result.forEach((series: any, index: number) => {
            content += `Series ${index + 1}:\n`;
            content += `  Labels: ${JSON.stringify(series.metric)}\n`;
            content += `  Data Points: ${series.values.length}\n`;
            if (series.values.length > 0) {
              content += `  First Value: ${series.values[0][1]} at ${new Date(series.values[0][0] * 1000).toISOString()}\n`;
              content += `  Last Value: ${series.values[series.values.length - 1][1]} at ${new Date(series.values[series.values.length - 1][0] * 1000).toISOString()}\n`;
            }
            content += '\n';
          });
        }
      } else if (data.resultType === 'vector') {
        content += `Result Type: Instant Vector\n`;
        content += `Values Count: ${data.result.length}\n\n`;

        if (data.result.length === 0) {
          content += 'No data returned for this query.\n';
        } else {
          data.result.forEach((result: any, index: number) => {
            content += `Value ${index + 1}:\n`;
            content += `  Labels: ${JSON.stringify(result.metric)}\n`;
            content += `  Value: ${result.value[1]} at ${new Date(result.value[0] * 1000).toISOString()}\n\n`;
          });
        }
      } else {
        content += `Result Type: ${data.resultType}\n`;
        content += `Raw Data: ${JSON.stringify(data.result, null, 2)}\n`;
      }

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      throw new Error(`Failed to execute PromQL query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}