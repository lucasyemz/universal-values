import "server-only";
import { cache } from "react";
import { listWorkspaces } from "@/modules/workspaces/service";
export const getWorkspaceNavigation = cache(listWorkspaces);
