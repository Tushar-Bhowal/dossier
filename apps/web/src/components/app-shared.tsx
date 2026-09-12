import * as React from "react";
import { FolderGit2 } from "lucide-react";

export interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
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
        title: "Interview Kits",
        path: "/kits",
        icon: <FolderGit2 className="size-4" />,
      },
    ],
  },
];
