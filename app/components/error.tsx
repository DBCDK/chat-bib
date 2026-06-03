import React from "react";
import { IconButton } from "./button";
import GithubIcon from "../icons/github.svg";
import ResetIcon from "../icons/reload.svg";
import { StoreKey } from "../constant";
import Locale from "../locales";
import { showConfirm } from "./ui-lib";
import {
  useAccessStore,
  useAppConfig,
  useChatStore,
} from "../store";
import { useMaskStore } from "../store/mask";
import { usePromptStore } from "../store/prompt";
import { downloadAs } from "../utils";

interface IErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  info: React.ErrorInfo | null;
}

function getStoreData<T extends object>(store: T) {
  return Object.fromEntries(
    Object.entries(store).filter(([, value]) => typeof value !== "function"),
  );
}

function exportLocalBackup() {
  const state = {
    [StoreKey.Chat]: getStoreData(useChatStore.getState()),
    [StoreKey.Access]: getStoreData(useAccessStore.getState()),
    [StoreKey.Config]: getStoreData(useAppConfig.getState()),
    [StoreKey.Mask]: getStoreData(useMaskStore.getState()),
    [StoreKey.Prompt]: getStoreData(usePromptStore.getState()),
  };
  const fileName = `Backup-${new Date().toLocaleString()}.json`;
  downloadAs(JSON.stringify(state), fileName);
}

export class ErrorBoundary extends React.Component<any, IErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Update state with error details
    this.setState({ hasError: true, error, info });
  }

  clearAndSaveData() {
    try {
      exportLocalBackup();
    } finally {
      localStorage.clear();
      location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      // Render error message
      return (
        <div className="error">
          <h2>Oops, something went wrong!</h2>
          <pre>
            <code>{this.state.error?.toString()}</code>
            <code>{this.state.info?.componentStack}</code>
          </pre>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <IconButton text="Report This Error" icon={<GithubIcon />} bordered />
            <IconButton
              icon={<ResetIcon />}
              text="Clear All Data"
              onClick={async () => {
                if (await showConfirm(Locale.Settings.Danger.Reset.Confirm)) {
                  this.clearAndSaveData();
                }
              }}
              bordered
            />
          </div>
        </div>
      );
    }
    // if no error occurred, render children
    return this.props.children;
  }
}
