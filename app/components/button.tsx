import * as React from "react";
import styles from "./button.module.scss";

export type ButtonType = "primary" | "danger" | null;

export function IconButton(props: {
  onClick?: () => void;
  icon?: JSX.Element;
  type?: ButtonType;
  text?: string;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  size?: 1 | 2 | 3 | 4 | 5;
}) {
  const size = props.size ?? 2; // Default size is 2

  return (
    <button
      className={
        styles["icon-button"] +
        ` ${props.bordered && styles.border} ${props.shadow && styles.shadow} ${
          props.className ?? ""
        } clickable ${styles[props.type ?? ""]} ${styles[`size-${size}`]}`
      }
      onClick={props.onClick}
      title={props.title}
      disabled={props.disabled}
      role="button"
      tabIndex={props.tabIndex}
      autoFocus={props.autoFocus}
    >
      {props.icon && (
        <div
          className={
            styles["icon-button-icon"] +
            ` ${props.type === "primary" && "no-dark"} ${styles[`icon-size-${size}`]}`
          }
        >
          {props.icon}
        </div>
      )}

      {props.text && (
        <div
          className={`${styles["icon-button-text"]} ${styles[`text-size-${size}`]}`}
        >
          {props.text}
        </div>
      )}
    </button>
  );
}
