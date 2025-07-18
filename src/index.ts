#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  ListToolsResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GrafanaClient } from './grafana-client.js';

const server = new Server(
  {
    name: 'grafana-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const grafanaClient = new GrafanaClient();

const tools: Tool[] = [
  {
    name: 'login',
    description: 'Get a login URL to authenticate with Grafana via Google OAuth',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_session_cookie',
    description: 'Set the session cookie after logging in through the browser',
    inputSchema: {
      type: 'object',
      properties: {
        cookie: {
          type: 'string',
          description: 'The grafana_session cookie value from your browser',
        },
      },
      required: ['cookie'],
    },
  },
  {
    name: 'set_server',
    description: 'Set the Grafana server URL to connect to a different Grafana instance',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The base URL of the Grafana server (e.g., https://grafana.example.com)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_server_info',
    description: 'Get information about the current Grafana server and connection status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'test_authentication',
    description: 'Test if current authentication is working',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'query_dashboard',
    description: 'Query a specific dashboard by its UID or slug',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: 'Dashboard UID (preferred) or slug',
        },
        includeData: {
          type: 'boolean',
          description: 'Whether to include panel data in the response',
          default: false,
        },
      },
      required: ['uid'],
    },
  },
  {
    name: 'search_dashboards',
    description: 'Search for dashboards by name or tag',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for dashboard names',
        },
        tag: {
          type: 'string',
          description: 'Tag to filter dashboards by',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        },
      },
    },
  },
  {
    name: 'query_panel_data',
    description: 'Query data from a specific panel in a dashboard',
    inputSchema: {
      type: 'object',
      properties: {
        dashboardUid: {
          type: 'string',
          description: 'Dashboard UID containing the panel',
        },
        panelId: {
          type: 'number',
          description: 'Panel ID to query',
        },
        from: {
          type: 'string',
          description: 'Start time (relative like "now-1h" or absolute timestamp)',
          default: 'now-1h',
        },
        to: {
          type: 'string',
          description: 'End time (relative like "now" or absolute timestamp)',
          default: 'now',
        },
      },
      required: ['dashboardUid', 'panelId'],
    },
  },
  {
    name: 'get_dashboard_panels',
    description: 'Get all panels from a dashboard with their metadata',
    inputSchema: {
      type: 'object',
      properties: {
        dashboardUid: {
          type: 'string',
          description: 'Dashboard UID',
        },
      },
      required: ['dashboardUid'],
    },
  },
  {
    name: 'list_datasources',
    description: 'List all available datasources in Grafana',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_available_metrics',
    description: 'Get all available metrics from Prometheus, optionally filtered by search term',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional search term to filter metrics',
        },
        datasourceId: {
          type: 'string',
          description: 'Datasource ID (numeric, not UID) - use list_datasources to find available IDs',
        },
      },
    },
  },
  {
    name: 'get_tags_for_metric',
    description: 'Get all available labels/tags for a specific metric',
    inputSchema: {
      type: 'object',
      properties: {
        metric_name: {
          type: 'string',
          description: 'Full metric name to get tags for',
        },
        datasourceId: {
          type: 'string',
          description: 'Datasource ID (numeric, not UID) - use list_datasources to find available IDs',
        },
      },
      required: ['metric_name'],
    },
  },
  {
    name: 'promql',
    description: 'Execute raw PromQL query - use Unix timestamps for time range',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'PromQL query to execute',
        },
        from: {
          type: 'string',
          description: 'Start time as Unix timestamp (calculate with: date +%s)',
          default: 'now-1h',
        },
        to: {
          type: 'string',
          description: 'End time as Unix timestamp (calculate with: date +%s)',
          default: 'now',
        },
        datasourceId: {
          type: 'string',
          description: 'Datasource ID (numeric, not UID) - use list_datasources to find available IDs',
        },
      },
      required: ['query'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'login':
        return await grafanaClient.getLoginUrl();

      case 'set_session_cookie':
        return await grafanaClient.setSessionCookie(args?.cookie as string);

      case 'set_server':
        return await grafanaClient.setServer(args?.url as string);

      case 'get_server_info':
        return await grafanaClient.getServerInfo();

      case 'test_authentication':
        return await grafanaClient.testAuthentication();

      case 'query_dashboard':
        return await grafanaClient.queryDashboard(args?.uid as string, args?.includeData as boolean);

      case 'search_dashboards':
        return await grafanaClient.searchDashboards(args?.query as string, args?.tag as string, args?.limit as number);

      case 'query_panel_data':
        return await grafanaClient.queryPanelData(
          args?.dashboardUid as string,
          args?.panelId as number,
          args?.from as string,
          args?.to as string
        );

      case 'get_dashboard_panels':
        return await grafanaClient.getDashboardPanels(args?.dashboardUid as string);

      case 'list_datasources':
        return await grafanaClient.listDatasources();

      case 'get_available_metrics':
        return await grafanaClient.getAvailableMetrics(args?.search as string, args?.datasourceId as string);

      case 'get_tags_for_metric':
        return await grafanaClient.getTagsForMetric(args?.metric_name as string, args?.datasourceId as string);

      case 'promql':
        return await grafanaClient.executePromQL(args?.query as string, args?.from as string, args?.to as string, args?.datasourceId as string);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Grafana MCP server running on stdio');
}

main().catch(console.error);
