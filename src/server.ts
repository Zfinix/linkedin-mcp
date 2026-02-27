import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import type { AppConfig } from './config.js';
import { storedAccessToken, storedUserId, sharePost, shareLink, loadTokenData, getUserInfo, deletePost, likePost, unlikePost, commentOnPost, listPosts, getPost, getPostComments, getPostLikes, resharePost, sharePostWithImage } from './linkedinApi.js';
import { z } from 'zod';

function createMcpServer(config: AppConfig): McpServer {
  const server = new McpServer(
    { name: 'linkedin-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.tool(
    'linkedin-share-post',
    'Shares a text post to LinkedIn.',
    { text: z.string().min(1).describe('The content of the post to share.') },
    async ({ text }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.`,
            },
          ],
        };
      }
      try {
        const result = await sharePost(storedUserId, text);
        return {
          content: [
            {
              type: 'text',
              text: `Post shared successfully! ${result.postId ? `(Post ID: ${result.postId})` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to share post: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-share-link',
    'Shares a link with commentary to LinkedIn.',
    {
      text: z.string().min(1).describe('The commentary text to accompany the link.'),
      url: z.string().url().describe('The URL of the link to share.'),
    },
    async ({ text, url }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.`,
            },
          ],
        };
      }
      try {
        const result = await shareLink(storedUserId, text, url);
        return {
          content: [
            {
              type: 'text',
              text: `Link shared successfully! ${result.postId ? `(Post ID: ${result.postId})` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to share link: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-get-profile',
    'Gets the authenticated LinkedIn user profile info including headline, location, industry, and summary.',
    {},
    async () => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.` }],
        };
      }
      try {
        const profile = await getUserInfo(storedAccessToken);

        const lines = [
          `Name: ${profile.name}`,
          `First name: ${profile.given_name}`,
          `Last name: ${profile.family_name}`,
          `Email: ${profile.email} (verified: ${profile.email_verified})`,
          `User ID: ${storedUserId}`,
        ];
        if (profile.picture) lines.push(`Profile picture: ${profile.picture}`);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get profile: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-delete-post',
    'Deletes a LinkedIn post by its ID or URN (e.g. "123456789" or "urn:li:ugcPost:123456789").',
    { postId: z.string().min(1).describe('The post ID or full URN to delete.') },
    async ({ postId }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.`,
            },
          ],
        };
      }
      try {
        await deletePost(postId);
        return {
          content: [{ type: 'text', text: `Post deleted successfully.` }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to delete post: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-like-post',
    'Likes a LinkedIn post by its ID or URN.',
    { postId: z.string().min(1).describe('The post ID or full URN to like.') },
    async ({ postId }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.`,
            },
          ],
        };
      }
      try {
        await likePost(storedUserId, postId);
        return {
          content: [{ type: 'text', text: `Post liked successfully.` }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to like post: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-comment-on-post',
    'Adds a comment to a LinkedIn post.',
    {
      postId: z.string().min(1).describe('The post ID or full URN to comment on.'),
      text: z.string().min(1).describe('The comment text.'),
    },
    async ({ postId, text }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.`,
            },
          ],
        };
      }
      try {
        const result = await commentOnPost(storedUserId, postId, text);
        return {
          content: [
            {
              type: 'text',
              text: `Comment added successfully! ${result.commentId ? `(Comment ID: ${result.commentId})` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to add comment: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-list-posts',
    'Lists recent posts from the authenticated LinkedIn user. NOTE: requires r_member_social scope which is only available to LinkedIn partner apps.',
    { count: z.number().int().min(1).max(50).default(10).describe('Number of posts to retrieve (max 50).') },
    async ({ count }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.`,
            },
          ],
        };
      }
      try {
        const posts = await listPosts(storedUserId, count);
        if (posts.length === 0) {
          return { content: [{ type: 'text', text: 'No posts found.' }] };
        }
        const formatted = posts.map((p, i) => {
          const content = p.specificContent?.['com.linkedin.ugc.ShareContent'];
          const text = content?.shareCommentary?.text ?? '(no text)';
          const date = new Date(p.created.time).toLocaleDateString();
          return `${i + 1}. [${date}] ${p.id}\n   ${text}`;
        }).join('\n\n');
        return { content: [{ type: 'text', text: formatted }] };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list posts: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-share-post-with-image',
    'Shares a LinkedIn post with an image. Provide a local file path to the image.',
    {
      text: z.string().min(1).describe('The post text.'),
      imagePath: z.string().min(1).describe('Absolute path to the image file (jpg, jpeg, png, or gif).'),
    },
    async ({ text, imagePath }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.`,
            },
          ],
        };
      }
      try {
        const result = await sharePostWithImage(storedUserId, text, imagePath);
        return {
          content: [
            {
              type: 'text',
              text: `Post with image shared successfully! ${result.postId ? `(Post ID: ${result.postId})` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to share post with image: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'linkedin-get-post',
    'Gets the content and details of a specific LinkedIn post by its ID or URN.',
    { postId: z.string().min(1).describe('The post ID or full URN (e.g. "123456789" or "urn:li:ugcPost:123456789").') },
    async ({ postId }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.` }],
        };
      }
      try {
        const post = await getPost(postId);
        const content = post.specificContent?.['com.linkedin.ugc.ShareContent'];
        const text = content?.shareCommentary?.text ?? '(no text)';
        const date = new Date(post.created.time).toLocaleDateString();
        return {
          content: [{ type: 'text', text: `Post ID: ${post.id}\nDate: ${date}\nStatus: ${post.lifecycleState}\n\n${text}` }],
        };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to get post: ${error.message}` }] };
      }
    }
  );

  server.tool(
    'linkedin-get-post-comments',
    'Gets comments on a LinkedIn post.',
    {
      postId: z.string().min(1).describe('The post ID or full URN.'),
      count: z.number().int().min(1).max(50).default(10).describe('Number of comments to retrieve (max 50).'),
    },
    async ({ postId, count }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.` }],
        };
      }
      try {
        const comments = await getPostComments(postId, count);
        if (comments.length === 0) return { content: [{ type: 'text', text: 'No comments found.' }] };
        const formatted = comments.map((c, i) => {
          const date = new Date(c.created.time).toLocaleDateString();
          return `${i + 1}. [${date}] ${c.actor}\n   ${c.message?.text ?? ''}`;
        }).join('\n\n');
        return { content: [{ type: 'text', text: formatted }] };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to get comments: ${error.message}` }] };
      }
    }
  );

  server.tool(
    'linkedin-get-post-likes',
    'Gets the like count and recent likers of a LinkedIn post.',
    {
      postId: z.string().min(1).describe('The post ID or full URN.'),
      count: z.number().int().min(1).max(50).default(10).describe('Number of likes to retrieve (max 50).'),
    },
    async ({ postId, count }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.` }],
        };
      }
      try {
        const { likes, total } = await getPostLikes(postId, count);
        const actors = likes.map((l) => l.actor).join('\n');
        return {
          content: [{ type: 'text', text: `Total likes: ${total}\n\nRecent likers:\n${actors || '(none)'}` }],
        };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to get likes: ${error.message}` }] };
      }
    }
  );

  server.tool(
    'linkedin-reshare-post',
    'Reshares an existing LinkedIn post with optional commentary. Provide the full URN of the original post (e.g. "urn:li:ugcPost:123456789" or "urn:li:share:123456789").',
    {
      shareUrn: z.string().min(1).describe('Full URN of the post to reshare.'),
      text: z.string().default('').describe('Optional commentary to add to the reshare.'),
    },
    async ({ shareUrn, text }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.` }],
        };
      }
      try {
        const result = await resharePost(storedUserId, shareUrn, text);
        return {
          content: [{ type: 'text', text: `Post reshared successfully! ${result.postId ? `(Post ID: ${result.postId})` : ''}` }],
        };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to reshare post: ${error.message}` }] };
      }
    }
  );

  server.tool(
    'linkedin-unlike-post',
    'Removes a like from a LinkedIn post.',
    { postId: z.string().min(1).describe('The post ID or full URN to unlike.') },
    async ({ postId }) => {
      await loadTokenData();
      if (!storedAccessToken || !storedUserId) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Authentication required. Please visit http://localhost:${config.authPort}/auth/linkedin in your browser.` }],
        };
      }
      try {
        await unlikePost(storedUserId, postId);
        return { content: [{ type: 'text', text: 'Post unliked successfully.' }] };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to unlike post: ${error.message}` }] };
      }
    }
  );

  return server;
}

async function main() {
  const config = loadConfig();
  await loadTokenData();
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
