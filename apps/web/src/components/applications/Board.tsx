"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CLOSED_STATUSES, type ApplicationRecord, type ApplicationStatus } from "@dossier/core/applications";
import { cn } from "@/lib/utils";
import { ApplicationCard } from "./ApplicationCard";
import { BOARD_COLUMNS, STATUS_LABEL, STATUS_TONE, columnOf, type BoardColumnId } from "./statusStyle";

interface BoardProps {
  records: ApplicationRecord[];
  today: string;
  onOpen: (id: string) => void;
  onMove: (id: string, status: ApplicationStatus) => void;
}

function DraggableCard({ record, today, onOpen, onMove }: { record: ApplicationRecord } & Omit<BoardProps, "records" | "onMove"> & {
  onMove: (status: ApplicationStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: record.id });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Drag ${record.application.role} at ${record.application.company} to another stage`}
      className="touch-none list-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ApplicationCard record={record} today={today} onOpen={() => onOpen(record.id)} onMove={onMove} dragging={isDragging} />
    </li>
  );
}

function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-[background-color,box-shadow] duration-150",
        isOver && "bg-primary/[0.07] shadow-[inset_0_0_0_1.5px_rgba(220,48,25,0.55)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Board({ records, today, onOpen, onMove }: BoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const byId = React.useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const active = activeId ? byId.get(activeId) : undefined;

  const columns = React.useMemo(() => {
    const grouped = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.id, [] as ApplicationRecord[]])) as Record<
      BoardColumnId,
      ApplicationRecord[]
    >;
    for (const record of records) grouped[columnOf(record.application.status)].push(record);
    return grouped;
  }, [records]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const record = byId.get(String(event.active.id));
    const target = event.over ? String(event.over.id) : null;
    if (!record || !target || target === "closed") return;
    const status = target as ApplicationStatus;
    if (status !== record.application.status) onMove(record.id, status);
  }

  const label = (id: string | number) => {
    const app = byId.get(String(id))?.application;
    return app ? `${app.role} at ${app.company}` : "application";
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over ? `${label(active.id)} is over ${STATUS_LABEL[over.id as ApplicationStatus] ?? "Closed"}.` : undefined,
          onDragEnd: ({ active, over }) =>
            over ? `Moved ${label(active.id)} to ${STATUS_LABEL[over.id as ApplicationStatus] ?? "Closed"}.` : `Put back ${label(active.id)}.`,
          onDragCancel: ({ active }) => `Cancelled moving ${label(active.id)}.`,
        },
      }}
    >
      <div className="-mx-1 grid auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
        {BOARD_COLUMNS.map((column) => {
          const items = columns[column.id];
          const tone = STATUS_TONE[column.id === "closed" ? "rejected" : column.id];
          const showClosedTargets = column.id === "closed" && active && columnOf(active.application.status) !== "closed";
          return (
            <section
              key={column.id}
              aria-label={`${column.label}, ${items.length}`}
              className="flex min-h-[420px] flex-col rounded-lg border border-white/[0.06] bg-white/[0.02] p-2"
            >
              <header className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
                <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden />
                <h2 className="text-[15px] font-semibold text-white">{column.label}</h2>
                <span className="rounded-lg bg-white/[0.06] px-1.5 text-[13px] font-semibold tabular-nums text-white/60">{items.length}</span>
              </header>

              {showClosedTargets ? (
                <div className="flex flex-1 flex-col gap-2">
                  {CLOSED_STATUSES.map((status) => (
                    <DropZone
                      key={status}
                      id={status}
                      className="flex flex-1 items-center justify-center border border-dashed border-white/15 text-sm font-semibold text-white/60"
                    >
                      {STATUS_LABEL[status]}
                    </DropZone>
                  ))}
                </div>
              ) : (
                <DropZone id={column.id === "closed" ? "closed" : column.id} className="flex flex-1 flex-col">
                  {items.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {items.map((record) => (
                        <DraggableCard
                          key={record.id}
                          record={record}
                          today={today}
                          onOpen={onOpen}
                          onMove={(status) => onMove(record.id, status)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="m-1 flex flex-1 items-start rounded-lg border border-dashed border-white/[0.08] p-4 text-sm font-medium text-white/40">
                      {column.empty}
                    </p>
                  )}
                </DropZone>
              )}
            </section>
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {active ? <ApplicationCard record={active} today={today} onOpen={() => {}} onMove={() => {}} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
