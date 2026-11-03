declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_TEXT_MODEL?: string;
    OPENAI_IMAGE_MODEL?: string;
    AI_DAILY_LIMIT?: string;
    AI_OWNER_ID?: string;
  }
}
