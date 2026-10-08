import * as React from "react";
import { FileText, FolderKanban, House, Map, Mic, MousePointerClick, Plug, SquareKanban } from "lucide-react";

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
        title: "Home",
        path: "/home",
        icon: <House className="size-[18px]" />,
      },
      {
        title: "Interview kits",
        path: "/kits",
        icon: <FolderKanban className="size-[18px]" />,
      },
      {
        title: "Applications",
        path: "/applications",
        icon: <SquareKanban className="size-[18px]" />,
      },
      {
        title: "Resume Studio",
        path: "/resumes",
        icon: <FileText className="size-[18px]" />,
      },
      {
        title: "Roadmaps",
        path: "/roadmaps",
        icon: <Map className="size-[18px]" />,
      },
      {
        title: "Mock interviews",
        path: "/interviews",
        icon: <Mic className="size-[18px]" />,
      },
      {
        title: "Autofill",
        path: "/autofill",
        icon: <MousePointerClick className="size-[18px]" />,
      },
      {
        title: "AI assistants",
        path: "/assistants",
        icon: <Plug className="size-[18px]" />,
      },
    ],
  },
];
