export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export interface UserInfoResponse {
  sub: string;
  email_verified: boolean;
  name: string;
  locale: object;
  given_name: string;
  family_name: string;
  email: string;
  picture: string;
}

export interface ShareResult {
  success: boolean;
  postId?: string | null;
}

export interface UgcPost {
  id: string;
  author: string;
  lifecycleState: string;
  created: { time: number };
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: string };
      shareMediaCategory: string;
      media?: Array<{ originalUrl?: string; media?: string }>;
    };
  };
}

interface MediaUploadHttpRequest {
  uploadUrl: string;
}

export interface MultiLocaleString {
  localized: Record<string, string>;
  preferredLocale: { country: string; language: string };
}

export interface LinkedInDetailedProfile {
  id: string;
  firstName: MultiLocaleString;
  lastName: MultiLocaleString;
  headline?: MultiLocaleString;
  summary?: string;
  location?: { country: { code: string }; region?: string };
  industry?: string;
  profilePicture?: {
    'displayImage~'?: {
      elements?: Array<{ identifiers: Array<{ identifier: string }> }>;
    };
  };
}

export interface PostComment {
  id: string;
  actor: string;
  created: { time: number };
  message: { text: string };
}

export interface PostLike {
  actor: string;
  created: { time: number };
}

export interface RegisterUploadResponse {
  value: {
    asset: string;
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': MediaUploadHttpRequest;
    };
  };
}
