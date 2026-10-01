import * as React from "react";
import { FileText, FolderKanban, Map, Mic } from "lucide-react";

export interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  soon?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Interview kits",
        path: "/kits",
        icon: <FolderKanban className="size-[18px]" />,
      },
      {
        title: "Resume Studio",
        path: "/resumes",
        icon: <FileText className="size-[18px]" />,
      },
    ],
  },
  {
    label: "Coming soon",
    items: [
      { title: "Roadmaps", path: "/roadmaps", icon: <Map className="size-[18px]" />, soon: true },
      { title: "Mock interviews", path: "/interviews", icon: <Mic className="size-[18px]" />, soon: true },
    ],
  },
];
