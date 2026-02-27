# LinkedIn MCP Server

A Model Context Protocol (MCP) server using the TypeScript SDK for LinkedIn integration. Allows an AI agent (e.g. Claude) to authenticate with LinkedIn and share posts or links.

## Credits

Fork of [agency42/linkedin-mcp](https://github.com/agency42/linkedin-mcp), originally created by **Ken** (kennycav93@gmail.com). This fork extends the base project with additional LinkedIn API tools and fixes.

---

## Code Changes (vs. Original)

### New MCP Tools

| Tool | Description |
|------|-------------|
| `linkedin-get-profile` | Fetch detailed user profile |
| `linkedin-delete-post` | Delete a post by ID |
| `linkedin-like-post` | Like a post |
| `linkedin-unlike-post` | Remove a like from a post |
| `linkedin-comment-on-post` | Add a comment to a post |
| `linkedin-list-posts` | List user's posts |
| `linkedin-get-post` | Fetch a single post by ID |
| `linkedin-get-post-comments` | Get comments on a post |
| `linkedin-get-post-likes` | Get likes on a post |
| `linkedin-reshare-post` | Reshare (repost) a post |
| `linkedin-share-post-with-image` | Share a post with an image |

### Config & API Changes

- **Config**: Fixed `.env` loading path (loads from project root regardless of `cwd`)
- **OAuth**: `exchangeCodeForToken` accepts optional `redirectUri` override
- **Share APIs**: `sharePost` and `shareLink` now take `userId` only (access token handled internally via stored token + refresh)

### New TypeScript Types

- `UgcPost`, `PostComment`, `PostLike`, `RegisterUploadResponse`
- `LinkedInDetailedProfile`, `MultiLocaleString`

### Removed

- Bulk docs (`mcp-doc.txt`, `modelcontextprotocol-typescript-sdk.txt`) moved/cleaned from repo

## Prerequisites

- Node.js (>=14) and npm
- LinkedIn Developer App:
  - Create an app at <https://www.linkedin.com/developers/apps>
  - Under "Products", add **Sign In with LinkedIn** (OpenID Connect) and **Share on LinkedIn**
  - **Authorized Redirect URI** must match `.env`: `http://localhost:8000/auth/linkedin/callback`
  - Copy your **Client ID** and **Client Secret** into `.env`

## Setup

```bash
git clone <repo_url>
cd linkedin-mcp
npm install
```

Create a `.env` in project root with:

```env
SESSION_SECRET=your-session-secret
AUTH_PORT=8000          # OAuth callback server port
HTTP_PORT=8001          # HTTP/SSE server port
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:8000/auth/linkedin/callback
```

## Running

1. **OAuth Callback Server** (must stay running):

   ```bash
   npm run dev:auth
   ```

2. **MCP Server**:
   - Via Claude Desktop:

     ```bash
     claude-desktop
     ```

   - Or manually:

     ```bash
     npm run dev
     ```

   - This starts stdio transport + HTTP+SSE server.

3. **Inspector UI**:

   ```bash
   npm run build
   npx @modelcontextprotocol/inspector node build/server.js
   ```

   - Open the Inspector in browser → **Tools**
   - Use `linkedin-share-post` or `linkedin-share-link` tools.

## Testing

1. Visit `http://localhost:8000/auth/linkedin` in browser → complete LinkedIn login.
2. Confirm “Authentication successful!”.
3. In Inspector, run sample post/link tools.
4. Verify content on your LinkedIn profile.

## Claude Desktop Integration

1. Run `npm run dev:auth`
2. Visit `http://localhost:8000/auth/linkedin` in browser → complete LinkedIn login.
3. Confirm “Authentication successful!”. A token file should be generated. Do not close this terminal.
4. Open Claude Desktop and verify the tools are listed

Configure your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/Users/ken/Desktop/lab/linkedin-mcp/build/server.js"],
      "transport": "http",
      "url": "http://localhost:8001",
      "sseEndpoint": "/stream",
      "httpEndpoint": "/message",
      "env": {
        "SESSION_SECRET": "your-session-secret",
        "AUTH_PORT": "8000",
        "HTTP_PORT": "8001",
        "LINKEDIN_CLIENT_ID": "your-client-id",
        "LINKEDIN_CLIENT_SECRET": "your-client-secret",
        "LINKEDIN_REDIRECT_URI": "http://localhost:8000/auth/linkedin/callback"
      }
    }
  },
  "globalShortcut": "Ctrl+Space"
}
```

(You can find this file from Claude Desktop by going to settings > developer > edit config)

Save and **restart Claude Desktop** to apply changes.
