# Grafana MCP Server

A Model Context Protocol (MCP) server that provides read-only access to Grafana dashboards and metrics. This server allows you to query your Grafana instance using natural language through any MCP-compatible client.

## Features

- 🔍 Search and query dashboards
- 📊 Retrieve panel data and metrics
- 🏥 Get microservices health status
- 👷 Monitor worker status and activity
- 🔐 Support for Google OAuth session cookies and service account tokens
- 📖 Read-only access (no dashboard modifications)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up authentication:**
   ```bash
   npm run dev
   # Then use the setup_authentication tool in your MCP client
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your authentication details
   ```

4. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

## Authentication

The MCP server provides an interactive authentication flow that works seamlessly with your chat client:

### Interactive Authentication (Recommended)

1. **Get Login URL**: Use the `login` tool to get a link to Grafana
2. **Login**: Click the link to open Grafana in your browser and log in with Google OAuth
3. **Extract Cookie**: Follow the instructions to copy your session cookie from browser dev tools
4. **Set Cookie**: Use the `set_session_cookie` tool to paste the cookie value

This flow allows you to authenticate directly from your chat interface without manually setting environment variables.

### Alternative: Environment Variables

If you prefer, you can still set authentication via environment variables:

```bash
# Session cookie from Google OAuth login
export GRAFANA_SESSION_COOKIE="grafana_session=YOUR_COOKIE_VALUE"

# OR service account token
export GRAFANA_AUTH_TOKEN="YOUR_SERVICE_ACCOUNT_TOKEN"
```

## Available Tools

### Authentication & Setup
- `login` - Get a login URL to authenticate with Grafana via Google OAuth
- `set_session_cookie` - Set your session cookie after logging in through the browser
- `test_authentication` - Verify your authentication is working

### Dashboard Operations
- `search_dashboards` - Search for dashboards by name or tag
- `query_dashboard` - Get dashboard details and panel summary
- `get_dashboard_panels` - List all panels in a dashboard with their queries

### Data Queries
- `query_panel_data` - Query specific panel data with time ranges
- `get_microservices_health` - Get health status from All Microservices dashboard
- `get_worker_status` - Get worker activity from Workers dashboard

## Usage Examples

### Authentication Flow
```typescript
// Step 1: Get login URL
{
  "tool": "login"
}

// Step 2: After logging in and copying the cookie
{
  "tool": "set_session_cookie",
  "arguments": {
    "cookie": "eyJrIjoiYWJjZGVmZ2hpams..."
  }
}

// Step 3: Test authentication
{
  "tool": "test_authentication"
}
```

### Basic Dashboard Search
```typescript
// Search for dashboards
{
  "tool": "search_dashboards",
  "arguments": {
    "query": "microservices",
    "limit": 5
  }
}

// Get dashboard details
{
  "tool": "query_dashboard",
  "arguments": {
    "uid": "dashboard-uid-here",
    "includeData": true
  }
}
```

### Monitoring Queries
```typescript
// Check microservices health
{
  "tool": "get_microservices_health",
  "arguments": {
    "from": "now-2h",
    "to": "now"
  }
}

// Monitor worker status
{
  "tool": "get_worker_status",
  "arguments": {
    "from": "now-1h",
    "to": "now"
  }
}
```

### Panel Data Queries
```typescript
// Query specific panel data
{
  "tool": "query_panel_data",
  "arguments": {
    "dashboardUid": "dashboard-uid",
    "panelId": 123,
    "from": "now-6h",
    "to": "now"
  }
}
```

## Configuration

Create a `.env` file with your configuration:

```env
GRAFANA_BASE_URL=https://your-grafana-instance.example.com
GRAFANA_AUTH_TOKEN=your_service_account_token
# OR
GRAFANA_SESSION_COOKIE=grafana_session=your_session_cookie
```

## MCP Client Integration

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "grafana": {
      "command": "node",
      "args": ["path/to/grafana-mcp/dist/index.js"],
      "env": {
        "GRAFANA_BASE_URL": "https://your-grafana-instance.example.com",
        "GRAFANA_AUTH_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Common Questions

**Q: How do I get my session cookie?**
A: Use the `setup_authentication` tool for detailed instructions, or check the Authentication section above.

**Q: My session expired, what do I do?**
A: Session cookies expire periodically. Either refresh your session cookie or use a service account token for more stable access.

**Q: Can I modify dashboards through this MCP?**
A: No, this MCP is read-only for security. It only provides query and monitoring capabilities.

**Q: What if I get authentication errors?**
A: Use the `test_authentication` tool to diagnose issues, or check that your account has at least "Viewer" role in Grafana.

## Development

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run built version
npm start
```

## License

MIT