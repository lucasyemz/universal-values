import { createMcpHandler } from "@/connectors/mcp/handler";
import { createMcpRepository } from "@/connectors/mcp/repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = createMcpHandler(createMcpRepository, () => process.env.MCP_SERVER_ORIGIN);
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = handle;
