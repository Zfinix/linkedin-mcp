import { loadConfig } from './config.js';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import type { TokenResponse, UserInfoResponse, ShareResult, UgcPost, RegisterUploadResponse, PostComment, PostLike, LinkedInDetailedProfile, MultiLocaleString } from './types.js';

const config = loadConfig();
// ensure tokenStore.json is loaded from project root regardless of cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tokenFile = path.join(__dirname, '..', 'tokenStore.json');

let storedAccessToken: string | null = null;
let storedUserId: string | null = null;
let storedRefreshToken: string | null = null;
let storedExpiresAt = 0;

export async function loadTokenData(): Promise<void> {
    try {
        const content = await fs.readFile(tokenFile, 'utf-8');
        const { userId, accessToken, refreshToken, expiresAt } = JSON.parse(content);
        storedUserId = userId;
        storedAccessToken = accessToken;
        storedRefreshToken = refreshToken;
        storedExpiresAt = expiresAt;
    } catch {
    }
}

export function storeTokenData(userId: string, tokenData: TokenResponse) {
    storedUserId = userId;
    storedAccessToken = tokenData.access_token;
    storedRefreshToken = tokenData.refresh_token;
    storedExpiresAt = Date.now() + tokenData.expires_in * 1000;
    console.error(`Stored token for user URN: urn:li:person:${storedUserId}`);
    fs.writeFile(
        tokenFile,
        JSON.stringify({
            userId,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: storedExpiresAt
        }),
        'utf-8'
    )
        .then(() => console.error(`Token saved to ${tokenFile}`))
        .catch(err => console.error('Error saving token:', err));
}

export { storedAccessToken, storedUserId };

export async function exchangeCodeForToken(code: string, redirectUri?: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: config.linkedinClientId,
        client_secret: config.linkedinClientSecret,
        redirect_uri: redirectUri ?? config.linkedinRedirectUri,
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    if (!response.ok) throw new Error(`Access token request failed: ${response.statusText}`);
    return (await response.json()) as TokenResponse;
}

export async function getUserInfo(accessToken: string): Promise<UserInfoResponse> {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Get user info failed: ${response.statusText}`);
    return (await response.json()) as UserInfoResponse;
}

function extractLocale(field: MultiLocaleString): string {
    const key = `${field.preferredLocale.language}_${field.preferredLocale.country}`;
    return field.localized[key] ?? Object.values(field.localized)[0] ?? '';
}

export async function getDetailedProfile(accessToken: string): Promise<LinkedInDetailedProfile> {
    const response = await fetch('https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,headline)', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
        },
    });
    if (!response.ok) throw new Error(`Get detailed profile failed: ${response.statusText}`);
    return (await response.json()) as LinkedInDetailedProfile;
}

export { extractLocale };

export async function sharePost(
    userId: string,
    text: string
): Promise<ShareResult> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;

    const postBody = {
        author: `urn:li:person:${userId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text },
                shareMediaCategory: 'NONE',
            },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postBody),
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Share Post Error:', response.status, errorData);
        throw new Error(`Share post failed: ${response.statusText} - ${errorData}`);
    }
    return { success: true, postId: response.headers.get('x-restli-id') };
}

export async function shareLink(
    userId: string,
    text: string,
    url: string
): Promise<ShareResult> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;

    const postBody = {
        author: `urn:li:person:${userId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text },
                shareMediaCategory: 'ARTICLE',
                media: [{ status: 'READY', originalUrl: url }],
            },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postBody),
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Share Link Error:', response.status, errorData);
        throw new Error(`Share link failed: ${response.statusText} - ${errorData}`);
    }
    return { success: true, postId: response.headers.get('x-restli-id') };
}

function toUgcPostUrn(postId: string): string {
    if (postId.startsWith('urn:li:')) return postId;
    return `urn:li:ugcPost:${postId}`;
}

export async function deletePost(postId: string): Promise<void> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const postUrn = encodeURIComponent(toUgcPostUrn(postId));
    const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${postUrn}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'X-Restli-Protocol-Version': '2.0.0',
        },
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Delete Post Error:', response.status, errorData);
        throw new Error(`Delete post failed: ${response.statusText} - ${errorData}`);
    }
}

export async function likePost(userId: string, postId: string): Promise<void> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const shareUrn = encodeURIComponent(toUgcPostUrn(postId));
    const response = await fetch(`https://api.linkedin.com/v2/socialActions/${shareUrn}/likes`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({ actor: `urn:li:person:${userId}` }),
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Like Post Error:', response.status, errorData);
        throw new Error(`Like post failed: ${response.statusText} - ${errorData}`);
    }
}

export async function commentOnPost(
    userId: string,
    postId: string,
    text: string
): Promise<{ commentId: string | null }> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const shareUrn = encodeURIComponent(toUgcPostUrn(postId));
    const response = await fetch(`https://api.linkedin.com/v2/socialActions/${shareUrn}/comments`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
            actor: `urn:li:person:${userId}`,
            message: { text },
        }),
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Comment Error:', response.status, errorData);
        throw new Error(`Comment failed: ${response.statusText} - ${errorData}`);
    }
    return { commentId: response.headers.get('x-restli-id') };
}

export async function getPost(postId: string): Promise<UgcPost> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const postUrn = encodeURIComponent(toUgcPostUrn(postId));
    const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${postUrn}`, {
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'X-Restli-Protocol-Version': '2.0.0',
        },
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Get Post Error:', response.status, errorData);
        throw new Error(`Get post failed: ${response.statusText} - ${errorData}`);
    }
    return (await response.json()) as UgcPost;
}

export async function getPostComments(postId: string, count = 10): Promise<PostComment[]> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const shareUrn = encodeURIComponent(toUgcPostUrn(postId));
    const response = await fetch(
        `https://api.linkedin.com/v2/socialActions/${shareUrn}/comments?count=${count}`,
        {
            headers: {
                Authorization: `Bearer ${tokenToUse}`,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        }
    );
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Get Comments Error:', response.status, errorData);
        throw new Error(`Get comments failed: ${response.statusText} - ${errorData}`);
    }
    const data = (await response.json()) as { elements: PostComment[] };
    return data.elements;
}

export async function getPostLikes(postId: string, count = 10): Promise<{ likes: PostLike[]; total: number }> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const shareUrn = encodeURIComponent(toUgcPostUrn(postId));
    const response = await fetch(
        `https://api.linkedin.com/v2/socialActions/${shareUrn}/likes?count=${count}`,
        {
            headers: {
                Authorization: `Bearer ${tokenToUse}`,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        }
    );
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Get Likes Error:', response.status, errorData);
        throw new Error(`Get likes failed: ${response.statusText} - ${errorData}`);
    }
    const data = (await response.json()) as { elements: PostLike[]; paging: { total: number } };
    return { likes: data.elements, total: data.paging?.total ?? data.elements.length };
}

export async function resharePost(userId: string, shareUrn: string, text: string): Promise<ShareResult> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
            author: `urn:li:person:${userId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text },
                    shareMediaCategory: 'NONE',
                    resharedShareUrn: shareUrn,
                },
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Reshare Error:', response.status, errorData);
        throw new Error(`Reshare failed: ${response.statusText} - ${errorData}`);
    }
    return { success: true, postId: response.headers.get('x-restli-id') };
}

export async function unlikePost(userId: string, postId: string): Promise<void> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const shareUrn = encodeURIComponent(toUgcPostUrn(postId));
    const actorUrn = encodeURIComponent(`urn:li:person:${userId}`);
    const response = await fetch(
        `https://api.linkedin.com/v2/socialActions/${shareUrn}/likes/${actorUrn}`,
        {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${tokenToUse}`,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        }
    );
    if (!response.ok) {
        const errorData = await response.text();
        console.error('Unlike Error:', response.status, errorData);
        throw new Error(`Unlike failed: ${response.statusText} - ${errorData}`);
    }
}

export async function listPosts(userId: string, count = 10): Promise<UgcPost[]> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;
    const authorUrn = encodeURIComponent(`urn:li:person:${userId}`);
    const response = await fetch(
        `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${authorUrn})&count=${count}`,
        {
            headers: {
                Authorization: `Bearer ${tokenToUse}`,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        }
    );
    if (!response.ok) {
        const errorData = await response.text();
        console.error('List Posts Error:', response.status, errorData);
        throw new Error(`List posts failed: ${response.statusText} - ${errorData}`);
    }
    const data = (await response.json()) as { elements: UgcPost[] };
    return data.elements;
}

export async function sharePostWithImage(
    userId: string,
    text: string,
    imagePath: string
): Promise<ShareResult> {
    if (Date.now() >= storedExpiresAt) {
        console.error('Access token expired, refreshing...');
        await refreshAccessToken();
    }
    const tokenToUse = storedAccessToken!;

    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
            registerUploadRequest: {
                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                owner: `urn:li:person:${userId}`,
                serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
            },
        }),
    });
    if (!registerResponse.ok) {
        const errorData = await registerResponse.text();
        console.error('Register Upload Error:', registerResponse.status, errorData);
        throw new Error(`Image upload registration failed: ${registerResponse.statusText} - ${errorData}`);
    }
    const registerData = (await registerResponse.json()) as RegisterUploadResponse;
    const { asset, uploadMechanism } = registerData.value;
    const uploadUrl = uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;

    const imageBuffer = await fs.readFile(imagePath);
    const mimeTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
    const contentType = mimeTypes[path.extname(imagePath).toLowerCase()] ?? 'application/octet-stream';
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenToUse}`, 'Content-Type': contentType },
        body: imageBuffer,
    });
    if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        console.error('Image Upload Error:', uploadResponse.status, errorData);
        throw new Error(`Image upload failed: ${uploadResponse.statusText} - ${errorData}`);
    }

    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
            author: `urn:li:person:${userId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text },
                    shareMediaCategory: 'IMAGE',
                    media: [{ status: 'READY', media: asset }],
                },
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
    });
    if (!postResponse.ok) {
        const errorData = await postResponse.text();
        console.error('Share Post With Image Error:', postResponse.status, errorData);
        throw new Error(`Share post with image failed: ${postResponse.statusText} - ${errorData}`);
    }
    return { success: true, postId: postResponse.headers.get('x-restli-id') };
}

export async function refreshAccessToken(): Promise<void> {
    if (!storedRefreshToken) throw new Error('No refresh token available');
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedRefreshToken,
        client_id: config.linkedinClientId,
        client_secret: config.linkedinClientSecret,
    });
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    if (!response.ok) throw new Error(`Token refresh failed: ${response.statusText}`);
    const tokenData = (await response.json()) as TokenResponse;
    storedAccessToken = tokenData.access_token;
    storedRefreshToken = tokenData.refresh_token;
    storedExpiresAt = Date.now() + tokenData.expires_in * 1000;
    await fs.writeFile(
        tokenFile,
        JSON.stringify({
            userId: storedUserId,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: storedExpiresAt
        }),
        'utf-8'
    );
    console.error('Refreshed access token');
}
