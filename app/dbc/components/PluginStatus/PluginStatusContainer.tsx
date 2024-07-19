"use client";

import { useState } from "react";
import { useGlobalState } from "../hooks/useGlobalState";
import styles from "./PluginStatusContainer.module.css";

export function PluginStatusContainer({ parentId }: { parentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [data] = useGlobalState({
    key: parentId,
    initial: { actions: [] },
  });
  const lastAction = data?.actions?.[data?.actions?.length - 1];
  return (
    <div className={styles.container} onClick={() => setExpanded(!expanded)}>
      {expanded &&
        data.actions?.map((a: any, index: number) => {
          return <div key={a + index}>{a.description}</div>;
        })}
      {!expanded && <div>{lastAction?.description}</div>}
    </div>
  );
}
