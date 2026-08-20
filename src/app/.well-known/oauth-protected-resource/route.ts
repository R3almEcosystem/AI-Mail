import { protectedResourceMetadataResponse } from "@/lib/oauth-metadata";

export const dynamic = "force-dynamic";

export function GET() {
  return protectedResourceMetadataResponse();
}
